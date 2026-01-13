'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ShieldAlert, Lock, UserCheck, LogIn, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Countries with restricted cannabis product display (require verification)
// User requested to remove assumptions about blocked products/regions
const RESTRICTED_COUNTRIES: string[] = []; // ['GB', 'PT'] disabled

interface RestrictedRegionGateProps {
  children: React.ReactNode;
  countryCode: string;
}

interface ConsultationData {
  drGreenClientId: string | null;
  kycLink: string | null;
  isKycVerified: boolean;
  adminApproval: string;
}

export function RestrictedRegionGate({ children, countryCode }: RestrictedRegionGateProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (typeof status === 'undefined') {
    throw new Error('RestrictedRegionGate must be used within a SessionProvider.');
  }

  const isRestricted = RESTRICTED_COUNTRIES.includes(countryCode);

  useEffect(() => {
    const fetchConsultationData = async () => {
      if (status === 'loading' || !session?.user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/consultation/status');
        if (response.ok) {
          const data = await response.json();
          setConsultationData(data);
        }
      } catch (error) {
        console.error('Error fetching consultation status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsultationData();
  }, [session, status]);

  // If not a restricted country, show products freely
  if (!isRestricted) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading || status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--tenant-color-primary)' }}
        />
      </div>
    );
  }

  // Not logged in - require login
  if (!session?.user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto py-12"
      >
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--tenant-color-surface, var(--tenant-color-background))',
            borderColor: 'var(--tenant-color-border, rgba(0,0,0,0.2))'
          }}
        >
          <CardHeader className="text-center">
            <div
              className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.2)' }}
            >
              <Lock className="h-8 w-8" style={{ color: 'var(--tenant-color-primary)' }} />
            </div>
            <CardTitle
              className="text-xl"
              style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
            >
              Account Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}>
              Due to regulations in your region, you must sign in and complete medical verification
              to view our product catalog.
            </p>
            <div
              className="rounded-lg p-4 text-sm"
              style={{ backgroundColor: 'rgba(255,180,0,0.2)', color: 'var(--tenant-color-text)' }}
            >
              <ShieldAlert className="h-5 w-5 mx-auto mb-2" style={{ color: '#FFA500' }} />
              <p style={{ fontFamily: 'var(--tenant-font-base)' }}>
                Medical cannabis products in the UK and Portugal are only available to
                verified patients with valid prescriptions.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-4">
              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full"
                style={{
                  backgroundColor: 'var(--tenant-color-primary)',
                  color: 'white',
                  fontFamily: 'var(--tenant-font-base)'
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/consultation')}
                className="w-full"
              >
                Check Eligibility
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Logged in but no consultation submitted
  if (!consultationData || !consultationData.drGreenClientId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto py-12"
      >
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--tenant-color-surface, var(--tenant-color-background))',
            borderColor: 'var(--tenant-color-border, rgba(0,0,0,0.2))'
          }}
        >
          <CardHeader className="text-center">
            <div
              className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(255,180,0,0.2)' }}
            >
              <ShieldAlert className="h-8 w-8" style={{ color: '#FFA500' }} />
            </div>
            <CardTitle
              className="text-xl"
              style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
            >
              Medical Verification Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}>
              To comply with UK/Portugal regulations, you must complete our patient consultation
              and medical verification process before viewing products.
            </p>
            <div
              className="rounded-lg p-4 text-sm"
              style={{ backgroundColor: 'rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)' }}
            >
              <p
                className="font-medium mb-2"
                style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
              >
                Consultation includes:
              </p>
              <ul
                className="space-y-1 text-left"
                style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}
              >
                <li>• Personal information</li>
                <li>• Shipping address verification</li>
                <li>• Medical questionnaire</li>
                <li>• KYC identity verification</li>
              </ul>
            </div>
            <Button
              onClick={() => router.push('/consultation')}
              className="w-full"
              style={{
                backgroundColor: 'var(--tenant-color-primary)',
                color: 'white',
                fontFamily: 'var(--tenant-font-base)'
              }}
            >
              Start Patient Consultation
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Check if eligible (both KYC verified AND admin approved)
  const isEligible = consultationData.isKycVerified && consultationData.adminApproval === 'VERIFIED';

  // Consultation submitted but not verified
  if (!isEligible) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg mx-auto py-12"
      >
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--tenant-color-surface, var(--tenant-color-background))',
            borderColor: 'var(--tenant-color-border, rgba(0,0,0,0.2))'
          }}
        >
          <CardHeader className="text-center">
            <div
              className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(255,180,0,0.2)' }}
            >
              <UserCheck className="h-8 w-8" style={{ color: '#FFA500' }} />
            </div>
            <CardTitle
              className="text-xl"
              style={{ color: 'var(--tenant-color-heading)', fontFamily: 'var(--tenant-font-heading)' }}
            >
              Verification Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)' }}>
              Your patient consultation is under review. You'll be able to view and purchase
              products once your verification is complete.
            </p>

            <div
              className="rounded-lg p-4 space-y-3"
              style={{ backgroundColor: 'rgba(var(--tenant-color-primary-rgb, 28, 79, 77), 0.1)' }}
            >
              <div
                className="flex items-center justify-between text-sm"
                style={{ fontFamily: 'var(--tenant-font-base)' }}
              >
                <span style={{ color: 'var(--tenant-color-text)' }}>KYC Verification</span>
                <span style={{ color: consultationData.isKycVerified ? 'var(--tenant-color-primary)' : '#FFA500' }}>
                  {consultationData.isKycVerified ? '✓ Verified' : 'Pending'}
                </span>
              </div>
              <div
                className="flex items-center justify-between text-sm"
                style={{ fontFamily: 'var(--tenant-font-base)' }}
              >
                <span style={{ color: 'var(--tenant-color-text)' }}>Medical Approval</span>
                <span style={{ color: consultationData.adminApproval === 'VERIFIED' ? 'var(--tenant-color-primary)' : '#FFA500' }}>
                  {consultationData.adminApproval === 'VERIFIED' ? '✓ Approved' : consultationData.adminApproval}
                </span>
              </div>
            </div>

            {consultationData.kycLink && !consultationData.isKycVerified && (
              <Button
                variant="outline"
                onClick={() => window.open(consultationData.kycLink!, '_blank')}
                className="w-full"
              >
                Complete KYC Verification
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}

            <p
              className="text-xs"
              style={{ color: 'var(--tenant-color-text)', fontFamily: 'var(--tenant-font-base)', opacity: 0.7 }}
            >
              Verification typically takes 1-2 business days. You'll receive an email once approved.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Verified - show products
  return <>{children}</>;
}
