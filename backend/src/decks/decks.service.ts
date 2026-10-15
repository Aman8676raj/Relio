import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// NOTE: For production, replace local storage with S3/R2 upload using @aws-sdk/client-s3
// The interface is identical — just swap writeLocalFile for putObject

@Injectable()
export class DecksService {
  private readonly logger = new Logger(DecksService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Use configured path or local uploads dir as fallback
    this.uploadDir = this.config.get('DECK_UPLOAD_DIR') ?? path.join(process.cwd(), 'uploads', 'decks');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadDeck(userId: string, file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = crypto.randomUUID() + ext;
    const localPath = path.join(this.uploadDir, safeName);

    // Save locally (swap with S3 putObject in production)
    fs.writeFileSync(localPath, file.buffer);

    const storageUrl = `/api/decks/files/${safeName}`; // served as static or via presigned URL

    const deck = await this.prisma.pitchDeck.create({
      data: {
        userId,
        filename: file.originalname,
        storageUrl,
        pageCount: 0, // would be extracted via pdf-parse in production
      },
    });

    this.logger.log(`Deck uploaded: ${deck.id} by user ${userId}`);
    return deck;
  }

  async listDecks(userId: string) {
    return this.prisma.pitchDeck.findMany({
      where: { userId, isActive: true },
      include: {
        shares: {
          include: {
            views: {
              select: { startedAt: true, completedAt: true, pagesViewed: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createShare(
    userId: string,
    deckId: string,
    contactId?: string,
    expiresInDays?: number,
  ) {
    const deck = await this.prisma.pitchDeck.findFirst({ where: { id: deckId, userId } });
    if (!deck) throw new NotFoundException('Deck not found');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const share = await this.prisma.deckShare.create({
      data: {
        deckId,
        contactId: contactId ?? null,
        expiresAt,
      },
    });

    const baseUrl = this.config.get('APP_URL') ?? 'https://app.relio.in';
    return {
      share,
      viewUrl: `${baseUrl}/deck/${share.shareToken}`,
    };
  }

  async getDeckByToken(token: string) {
    const share = await this.prisma.deckShare.findUnique({
      where: { shareToken: token },
      include: { deck: { select: { filename: true, storageUrl: true, pageCount: true } } },
    });

    if (!share) return null;
    if (share.expiresAt && share.expiresAt < new Date()) return null;

    return share.deck;
  }

  async startView(token: string, ip?: string) {
    const share = await this.prisma.deckShare.findUnique({ where: { shareToken: token } });
    if (!share) return null;

    const view = await this.prisma.deckView.create({
      data: {
        shareId: share.id,
        pagesViewed: [],
        timePerPage: {},
        viewerIp: ip ?? null,
      },
    });

    return view.id;
  }

  async recordPageView(viewId: string, page: number, seconds: number) {
    const view = await this.prisma.deckView.findUnique({ where: { id: viewId } });
    if (!view) return;

    const updatedPages = Array.from(new Set([...view.pagesViewed, page]));
    const updatedTime = { ...(view.timePerPage as Record<string, number>) };
    updatedTime[String(page)] = (updatedTime[String(page)] ?? 0) + seconds;

    await this.prisma.deckView.update({
      where: { id: viewId },
      data: { pagesViewed: updatedPages, timePerPage: updatedTime },
    });
  }

  async completeView(viewId: string) {
    await this.prisma.deckView.update({
      where: { id: viewId },
      data: { completedAt: new Date() },
    });
  }

  async getDeckAnalytics(userId: string, deckId: string) {
    const deck = await this.prisma.pitchDeck.findFirst({
      where: { id: deckId, userId },
      include: {
        shares: {
          include: {
            views: true,
          },
        },
      },
    });

    if (!deck) throw new NotFoundException('Deck not found');

    const allViews = deck.shares.flatMap((s) => s.views);

    const totalOpens = allViews.length;
    const completedViews = allViews.filter((v) => v.completedAt).length;
    const avgViewTimeSeconds =
      totalOpens > 0
        ? allViews.reduce((sum, v) => {
            const time = v.timePerPage as Record<string, number>;
            return sum + Object.values(time).reduce((a, b) => a + b, 0);
          }, 0) / totalOpens
        : 0;

    // Page engagement heatmap
    const pageEngagement: Record<number, number> = {};
    for (const view of allViews) {
      const time = view.timePerPage as Record<string, number>;
      for (const [page, secs] of Object.entries(time)) {
        pageEngagement[Number(page)] = (pageEngagement[Number(page)] ?? 0) + secs;
      }
    }

    return {
      deckId,
      totalOpens,
      completedViews,
      avgViewTimeSeconds: Math.round(avgViewTimeSeconds),
      pageEngagement,
      shareCount: deck.shares.length,
    };
  }
}
