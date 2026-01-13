'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
    LogIn,
    Mail,
    Lock,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function TenantLoginForm() {
    const params = useParams();
    const slug = params?.slug as string;
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Fetch tenant data
    const { data: tenantData, error: tenantError } = useSWR(
        slug ? `/api/tenant/${slug}` : null,
        fetcher
    );

    const tenant = tenantData?.tenant;
    const settings = tenant?.settings || {};
    const logoUrl = settings.logoPath?.startsWith('/') ? settings.logoPath : null;
    const primaryColor = settings.primaryColor || '#16a34a';

    // Check for messages from signup or other redirects
    const message = searchParams?.get('message');
    const error = searchParams?.get('error');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.password) newErrors.password = 'Password is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            if (result?.error) {
                throw new Error('Invalid email or password');
            }

            if (result?.ok) {
                toast.success('Signed in successfully!');

                // Fetch session to get user role
                const sessionResponse = await fetch('/api/auth/session');
                const sessionData = await sessionResponse.json();
                const userRole = sessionData?.user?.role;

                // Role-based redirect
                if (userRole === 'TENANT_ADMIN') {
                    // Tenant admins go to their admin dashboard
                    router.replace('/tenant-admin');
                } else if (userRole === 'SUPER_ADMIN') {
                    // Super admins should use the platform login, but redirect to super admin if they use this
                    toast.info('Redirecting to Super Admin dashboard...');
                    router.replace('/super-admin');
                } else {
                    // Patients/customers go to their dashboard
                    router.replace(`/store/${slug}/dashboard`);
                }
            }

        } catch (error: any) {
            toast.error(error.message || 'An error occurred during sign in');
        } finally {
            setIsLoading(false);
        }
    };

    // Google OAuth removed for regulatory compliance (KYC required)

    if (tenantError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenant Not Found</h2>
                    <p className="text-gray-600">The store you're looking for doesn't exist.</p>
                </div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-md w-full space-y-8"
            >
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <Link href={`/store/${slug}`} className="inline-block">
                            <div className="flex items-center justify-center space-x-2 mb-4">
                                {logoUrl ? (
                                    <div className="relative w-12 h-12">
                                        <Image
                                            src={logoUrl}
                                            alt={`${tenant.businessName} Logo`}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        <Store className="w-7 h-7 text-white" />
                                    </div>
                                )}
                                <span
                                    className="text-2xl font-bold font-serif"
                                    style={{ color: primaryColor }}
                                >
                                    {tenant.businessName}
                                </span>
                            </div>
                        </Link>
                        <h2 className="text-3xl font-bold text-gray-900 font-serif">Welcome Back</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in to your account
                        </p>
                    </div>

                    {/* Messages */}
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"
                        >
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <p className="text-sm text-green-800">{message}</p>
                            </div>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
                        >
                            <div className="flex items-center space-x-2">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <p className="text-sm text-red-800">
                                    {error === 'CredentialsSignin'
                                        ? 'Invalid email or password'
                                        : 'An error occurred during sign in'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Removed Google OAuth for regulatory compliance */}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <Label htmlFor="email" className="text-gray-700">Email Address</Label>
                            <div className="relative mt-1">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={`pl-10 bg-white border-gray-300 text-gray-900 ${errors.email ? 'border-red-500' : ''}`}
                                    placeholder="your@email.com"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <Label htmlFor="password" className="text-gray-700">Password</Label>
                            <div className="relative mt-1">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`pl-10 pr-10 bg-white border-gray-300 text-gray-900 ${errors.password ? 'border-red-500' : ''}`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Remember me and forgot password */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                                />
                                <Label htmlFor="rememberMe" className="text-sm text-gray-700">
                                    Remember me
                                </Label>
                            </div>
                            <Link
                                href={`/store/${slug}/forgot-password`}
                                className="text-sm hover:opacity-80 transition-opacity"
                                style={{ color: primaryColor }}
                            >
                                Forgot password?
                            </Link>
                        </div>

                        {/* Submit button */}
                        <Button
                            type="submit"
                            className="w-full text-white shadow-lg hover:shadow-xl transition-all duration-300"
                            style={{ backgroundColor: primaryColor }}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Signing In...
                                </div>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Check Eligibility link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600">
                            New patient?{' '}
                            <Link
                                href={`/store/${slug}/consultation`}
                                className="font-medium hover:opacity-80 transition-opacity"
                                style={{ color: primaryColor }}
                            >
                                Check Eligibility
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Back to store */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-center"
                >
                    <Link href={`/store/${slug}`}>
                        <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-800">
                            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                            Back to Store
                        </Button>
                    </Link>
                </motion.div>
            </motion.div>
        </div>
    );
}

export default function TenantLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        }>
            <TenantLoginForm />
        </Suspense>
    );
}
