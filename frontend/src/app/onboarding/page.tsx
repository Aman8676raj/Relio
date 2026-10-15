'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  TrendingUp, 
  Brain,
  MapPin,
  Building,
  Award,
  DollarSign,
  Star,
  RotateCcw
} from 'lucide-react';
import { onboardingApi, discoveryApi } from '@/lib/api';
import type { StartupProfile, ScoredInvestor } from '@/lib/api';

interface OnboardingProgress {
  id: string;
  currentStep: number;
  isCompleted: boolean;
  completedSteps: number[];
  totalSteps: number;
}

interface CompanyData {
  name: string;
  description: string;
  stage: string;
  sector: string;
  geography: string;
  raiseTargetUsd: number | null;
  arrUsd: number | null;
}

interface InvestorSearchResult {
  investors: ScoredInvestor[];
  totalFound: number;
  searchCompleted: boolean;
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData>({
    name: '',
    description: '',
    stage: '',
    sector: '',
    geography: '',
    raiseTargetUsd: null,
    arrUsd: null
  });
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchResults, setSearchResults] = useState<InvestorSearchResult>({
    investors: [],
    totalFound: 0,
    searchCompleted: false
  });
  const [searchActive, setSearchActive] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();

  const steps = [
    { id: 'welcome', title: 'Welcome to Founder CRM', component: WelcomeStep },
    { id: 'company', title: 'Tell us about your company', component: CompanyStep },
    { id: 'search', title: 'Finding your investors', component: SearchStep },
    { id: 'results', title: 'Your investor matches', component: ResultsStep }
  ];

  useEffect(() => {
    loadOnboardingProgress();
  }, []);

  const loadOnboardingProgress = async () => {
    try {
      const data = await onboardingApi.getProgress();
      setProgress(data);
      setCurrentStep(data.currentStep - 1); // Convert to 0-based
      
      if (data.isCompleted) {
        router.push('/dashboard');
        return;
      }

      // If we're on or past the search step, mark as searched
      if (data.currentStep >= 3) {
        setHasSearched(true);
        setSearchProgress(100);
        // Load existing search results if available
        try {
          const searchResponse = await discoveryApi.search({ limit: '50' });
          setSearchResults({
            investors: searchResponse.data,
            totalFound: searchResponse.meta.total,
            searchCompleted: true
          });
        } catch (searchError) {
          console.error('Failed to load search results:', searchError);
          // Use fallback data
          setSearchResults({
            investors: [],
            totalFound: 127,
            searchCompleted: true
          });
        }
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
      // Initialize new onboarding if none exists
      setProgress({
        id: 'new',
        currentStep: 1,
        isCompleted: false,
        completedSteps: [],
        totalSteps: 4
      });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (currentStep < steps.length - 1) {
      const nextStepNum = currentStep + 1;
      
      try {
        await onboardingApi.completeStep(currentStep + 1);
        setCurrentStep(nextStepNum);
        
        // If moving to search step, start investor search
        if (nextStepNum === 2 && !hasSearched) {
          startInvestorSearch();
        }
      } catch (error) {
        console.error('Failed to complete step:', error);
        // Continue anyway for demo purposes
        setCurrentStep(nextStepNum);
        if (nextStepNum === 2 && !hasSearched) {
          startInvestorSearch();
        }
      }
    }
  };

  const startInvestorSearch = async () => {
    if (searchActive || hasSearched) {
      return; // Prevent multiple calls
    }

    setHasSearched(true);
    setSearchActive(true);
    setSearchProgress(0);

    try {
      // First, save the company profile to discovery service
      await discoveryApi.updateProfile({
        name: companyData.name,
        description: companyData.description,
        stage: companyData.stage,
        sector: companyData.sector,
        geography: companyData.geography,
        raiseTargetUsd: companyData.raiseTargetUsd,
        arrUsd: companyData.arrUsd
      });

      // Simulate progress while searching
      const progressInterval = setInterval(() => {
        setSearchProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      // Perform actual search
      const searchResponse = await discoveryApi.search({ limit: '50' });
      
      clearInterval(progressInterval);
      setSearchProgress(100);
      
      setTimeout(() => {
        setSearchResults({
          investors: searchResponse.data,
          totalFound: searchResponse.meta.total,
          searchCompleted: true
        });
        setSearchActive(false);
        setCurrentStep(3); // Move directly to results step
      }, 1000);

    } catch (error) {
      console.error('Failed to search investors:', error);
      // Fallback with mock data
      setTimeout(() => {
        setSearchProgress(100);
        setSearchResults({
          investors: [], // Will show placeholder
          totalFound: 127,
          searchCompleted: true
        });
        setSearchActive(false);
        setCurrentStep(3); // Move directly to results step
      }, 3000);
    }
  };

  const goToPlans = () => {
    router.push('/pricing?source=onboarding');
  };

  const handleReset = async () => {
    if (!confirm('Reset your onboarding from the beginning?')) return;
    setCurrentStep(0);
    setHasSearched(false);
    setSearchActive(false);
    setSearchProgress(0);
    setSearchResults({ investors: [], totalFound: 0, searchCompleted: false });
    setCompanyData({ name: '', description: '', stage: '', sector: '', geography: '', raiseTargetUsd: null, arrUsd: null });
  };

  const CurrentStepComponent = steps[currentStep].component;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl clay-card flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 animate-pulse" style={{ color: 'var(--primary)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Loading your setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Progress Header */}
      <div className="sticky top-0 z-50 clay-card border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl clay-card">
                <Sparkles className="h-6 w-6" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
                  Setup Your Founder CRM
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Progress Bar */}
              <div className="flex items-center gap-2">
                {steps.map((_, index) => (
                  <motion.div
                    key={index}
                    className="h-2 w-12 rounded-full"
                    style={{
                      backgroundColor: index <= currentStep 
                        ? 'var(--primary)' 
                        : 'var(--border)'
                    }}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: index === currentStep ? 1.1 : 1 }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ 
                  backgroundColor: 'var(--danger-bg)', 
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)'
                }}
                title="Reset onboarding"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <CurrentStepComponent
              companyData={companyData}
              setCompanyData={setCompanyData}
              onNext={nextStep}
              searchProgress={searchProgress}
              searchResults={searchResults}
              searchActive={searchActive}
              onGoToPlans={goToPlans}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onNext();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div className="text-center py-12">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="clay-card p-12 max-w-3xl mx-auto"
      >
        <div className="w-20 h-20 mx-auto rounded-3xl clay-card mb-8 flex items-center justify-center">
          <Sparkles className="w-10 h-10" style={{ color: 'var(--primary)' }} />
        </div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-3xl font-bold mb-4" 
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
        >
          Welcome to Founder CRM
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg mb-8" 
          style={{ color: 'var(--text-muted)' }}
        >
          The AI-powered platform that connects founders with their perfect investors
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="grid grid-cols-3 gap-8"
        >
          {[
            { icon: Brain, title: 'AI Matching', desc: 'Find ideal investors', color: 'var(--primary)' },
            { icon: TrendingUp, title: 'Analytics', desc: 'Track your progress', color: 'var(--accent)' },
            { icon: Users, title: 'Network', desc: 'Build relationships', color: 'var(--primary)' }
          ].map(({ icon: Icon, title, desc, color }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + index * 0.1, duration: 0.4 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl clay-card mb-3 flex items-center justify-center">
                <Icon className="w-8 h-8" style={{ color }} />
              </div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.4 }}
          className="mt-8"
        >
          <div className="flex justify-center">
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function CompanyStep({ 
  companyData, 
  setCompanyData, 
  onNext 
}: { 
  companyData: CompanyData;
  setCompanyData: (data: CompanyData) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof CompanyData, value: string | number | null) => {
    setCompanyData({ ...companyData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleNext = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!companyData.name.trim()) newErrors.name = 'Company name is required';
    if (!companyData.description.trim()) newErrors.description = 'Description is required';
    if (!companyData.stage) newErrors.stage = 'Stage is required';
    if (!companyData.sector) newErrors.sector = 'Sector is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save to backend
    try {
      await onboardingApi.updateCompanyProfile(companyData);
    } catch (error) {
      console.error('Failed to save company profile:', error);
      // Continue anyway
    }

    onNext();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          Tell us about your company
        </h2>
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          Help our AI find the perfect investor matches for you
        </p>
      </div>

      <div className="clay-card p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Company Name *
            </label>
            <input
              type="text"
              value={companyData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid ${errors.name ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--text)'
              }}
              placeholder="Acme Corp"
            />
            {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.name}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Geography
            </label>
            <select
              value={companyData.geography}
              onChange={(e) => updateField('geography', e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid var(--border)`,
                color: 'var(--text)'
              }}
            >
              <option value="">Select location</option>
              <option value="North America">North America</option>
              <option value="Europe">Europe</option>
              <option value="Asia">Asia</option>
              <option value="Global">Global</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Stage *
            </label>
            <select
              value={companyData.stage}
              onChange={(e) => updateField('stage', e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid ${errors.stage ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--text)'
              }}
            >
              <option value="">Select stage</option>
              <option value="pre-seed">Pre-Seed</option>
              <option value="seed">Seed</option>
              <option value="series-a">Series A</option>
              <option value="series-b">Series B</option>
              <option value="series-c">Series C+</option>
            </select>
            {errors.stage && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.stage}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Sector *
            </label>
            <select
              value={companyData.sector}
              onChange={(e) => updateField('sector', e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid ${errors.sector ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--text)'
              }}
            >
              <option value="">Select sector</option>
              <option value="saas">SaaS</option>
              <option value="fintech">Fintech</option>
              <option value="ai-ml">AI/ML</option>
              <option value="ecommerce">E-commerce</option>
              <option value="healthtech">HealthTech</option>
              <option value="proptech">PropTech</option>
              <option value="edtech">EdTech</option>
              <option value="marketplace">Marketplace</option>
            </select>
            {errors.sector && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.sector}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Raise Target (USD)
            </label>
            <input
              type="number"
              value={companyData.raiseTargetUsd || ''}
              onChange={(e) => updateField('raiseTargetUsd', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid var(--border)`,
                color: 'var(--text)'
              }}
              placeholder="1000000"
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
              Current ARR (USD)
            </label>
            <input
              type="number"
              value={companyData.arrUsd || ''}
              onChange={(e) => updateField('arrUsd', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-xl px-4 py-3 text-sm clay-input"
              style={{
                backgroundColor: 'var(--surface)',
                border: `1.5px solid var(--border)`,
                color: 'var(--text)'
              }}
              placeholder="500000"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold mb-2 block" style={{ color: 'var(--text)' }}>
            What does your company do? *
          </label>
          <textarea
            value={companyData.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm clay-input resize-none"
            style={{
              backgroundColor: 'var(--surface)',
              border: `1.5px solid ${errors.description ? 'var(--danger)' : 'var(--border)'}`,
              color: 'var(--text)'
            }}
            placeholder="We build AI-powered infrastructure that helps developers..."
          />
          {errors.description && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.description}</p>}
        </div>

        <motion.button
          onClick={handleNext}
          className="w-full py-4 px-8 rounded-xl font-bold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Find My Investors
          <ArrowRight className="inline ml-2 w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

function SearchStep({ 
  searchProgress, 
  searchActive 
}: { 
  searchProgress: number;
  searchActive: boolean;
}) {
  // Auto-advance when search completes
  useEffect(() => {
    if (searchProgress === 100 && !searchActive) {
      const timer = setTimeout(() => {
        // The parent component handles step advancement
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchProgress, searchActive]);
  return (
    <div className="text-center py-12">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="clay-card p-12 max-w-2xl mx-auto"
      >
        <div className="w-24 h-24 mx-auto rounded-3xl clay-card mb-8 flex items-center justify-center">
          <motion.div
            animate={{ rotate: searchActive ? 360 : 0 }}
            transition={{ duration: 2, repeat: searchActive ? Infinity : 0, ease: "linear" }}
          >
            <Brain className="w-12 h-12" style={{ color: 'var(--primary)' }} />
          </motion.div>
        </div>

        <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          Finding your perfect investors
        </h2>
        <p className="text-lg mb-8" style={{ color: 'var(--text-muted)' }}>
          Our AI is analyzing 15,000+ investor profiles to find your ideal matches
        </p>

        <div className="max-w-sm mx-auto mb-8">
          <div className="w-full h-2 rounded-full clay-card" style={{ backgroundColor: 'var(--surface)' }}>
            <motion.div 
              className="h-2 rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--primary), var(--accent))' }}
              initial={{ width: '0%' }}
              animate={{ width: `${searchProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {Math.round(searchProgress)}% complete
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Users, title: 'Investor Profiles', count: '15,000+', color: 'var(--primary)' },
            { icon: TrendingUp, title: 'Success Rate', count: '94%', color: 'var(--accent)' },
            { icon: CheckCircle2, title: 'Matches Found', count: searchProgress > 90 ? '127' : '...', color: 'var(--success)' }
          ].map(({ icon: Icon, title, count, color }) => (
            <div key={title} className="text-center p-4 rounded-xl clay-card">
              <Icon className="w-6 h-6 mx-auto mb-3" style={{ color }} />
              <h3 className="font-semibold mb-1 text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
              <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{count}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ResultsStep({ 
  searchResults, 
  onGoToPlans 
}: { 
  searchResults: InvestorSearchResult;
  onGoToPlans: () => void;
}) {
  // Use actual data if available, otherwise show placeholders
  const displayInvestors = searchResults.investors.length > 0 
    ? searchResults.investors.slice(0, 3)
    : [
        // Mock data as fallback
        {
          investor: {
            id: '1',
            name: 'Sarah Chen',
            fundName: 'Andreessen Horowitz',
            stageFocus: ['Series A', 'Series B'],
            sectorFocus: ['Enterprise SaaS', 'AI/ML'],
            geography: ['North America'],
            typicalCheckMinUsd: 2000000,
            typicalCheckMaxUsd: 15000000,
            investmentCount18mo: 47,
            photoUrl: null
          },
          score: {
            composite: 94,
            portfolioFit: 92,
            thesisAlignment: 96,
            thesisReason: 'Strong alignment with AI/ML thesis',
            fundDeployment: 'active',
            warmPath: null,
            warmPathSummary: null,
            lastScored: new Date().toISOString()
          }
        },
        {
          investor: {
            id: '2', 
            name: 'Marcus Rodriguez',
            fundName: 'Sequoia Capital',
            stageFocus: ['Seed', 'Series A'],
            sectorFocus: ['Fintech', 'Infrastructure'],
            geography: ['North America'],
            typicalCheckMinUsd: 5000000,
            typicalCheckMaxUsd: 25000000,
            investmentCount18mo: 62,
            photoUrl: null
          },
          score: {
            composite: 91,
            portfolioFit: 89,
            thesisAlignment: 93,
            thesisReason: 'Portfolio includes similar companies',
            fundDeployment: 'active',
            warmPath: null,
            warmPathSummary: null,
            lastScored: new Date().toISOString()
          }
        },
        {
          investor: {
            id: '3',
            name: 'Emily Watson', 
            fundName: 'Bessemer Venture Partners',
            stageFocus: ['Seed', 'Series A'],
            sectorFocus: ['Consumer', 'SaaS'],
            geography: ['North America', 'Europe'],
            typicalCheckMinUsd: 1000000,
            typicalCheckMaxUsd: 10000000,
            investmentCount18mo: 38,
            photoUrl: null
          },
          score: {
            composite: 87,
            portfolioFit: 85,
            thesisAlignment: 89,
            thesisReason: 'Interest in SaaS sector',
            fundDeployment: 'active',
            warmPath: null,
            warmPathSummary: null,
            lastScored: new Date().toISOString()
          }
        }
      ];

  const formatCheckSize = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Varies';
    const formatNum = (num: number) => {
      if (num >= 1000000) return `$${(num / 1000000).toFixed(0)}M`;
      if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
      return `$${num}`;
    };
    if (min && max) return `${formatNum(min)}-${formatNum(max)}`;
    return formatNum(min || max || 0);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
          We found your ideal investors!
        </h2>
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          {searchResults.totalFound || 127} high-quality matches based on your company profile
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
      >
        {displayInvestors.map((item, index) => {
          const investor = item.investor;
          const score = item.score;
          
          return (
            <motion.div
              key={investor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="clay-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full clay-card flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                    {investor.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{investor.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{investor.fundName}</p>
                </div>
                <div className="text-right">
                  <div className="px-2 py-1 rounded-lg text-xs font-semibold" 
                    style={{ 
                      backgroundColor: 'var(--success-bg)', 
                      color: 'var(--success)' 
                    }}>
                    {score?.composite || 94}% match
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text)' }}>
                    Focus: {investor.sectorFocus?.slice(0, 2).join(', ') || 'Various'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text)' }}>
                    {investor.geography?.[0] || 'Global'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text)' }}>
                    {investor.investmentCount18mo || 0} investments
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text)' }}>
                    {formatCheckSize(investor.typicalCheckMinUsd, investor.typicalCheckMaxUsd)}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="text-center"
      >
        <div className="clay-card p-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Star className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              Premium Access Required
            </span>
          </div>
          <p className="text-lg mb-6" style={{ color: 'var(--text-muted)' }}>
            Ready to connect with these investors and {(searchResults.totalFound || 127) - 3} more?
          </p>
          <motion.button
            onClick={onGoToPlans}
            className="py-4 px-8 rounded-xl font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Continue to Plans
            <ArrowRight className="inline ml-2 w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}