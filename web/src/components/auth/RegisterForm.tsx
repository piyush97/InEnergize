import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Loader2, LinkedinIcon, Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, redirectTo = '/dashboard' }) => {
  const { register, loading } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptNewsletter, setAcceptNewsletter] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'You must accept the Terms of Service and Privacy Policy';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);
    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password
      });
      
      if (onSuccess) {
        onSuccess();
      } else {
        // Redirect to dashboard or onboarding
        window.location.href = redirectTo;
      }
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'Registration failed. Please try again.'
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = '/api/v1/auth/google?action=register';
  };

  const handleLinkedInSignup = () => {
    window.location.href = '/api/v1/auth/linkedin?action=register';
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    
    return {
      strength,
      label: labels[Math.min(strength, 4)],
      color: colors[Math.min(strength, 4)]
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Create your account
        </CardTitle>
        <p className="text-center text-gray-600">
          Start optimizing your LinkedIn presence today
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {errors.submit && (
          <Alert variant="destructive">
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`pl-10 ${errors.firstName ? 'border-red-500' : ''}`}
                  disabled={submitLoading || loading}
                />
              </div>
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`pl-10 ${errors.lastName ? 'border-red-500' : ''}`}
                  disabled={submitLoading || loading}
                />
              </div>
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleInputChange}
                className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                disabled={submitLoading || loading}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleInputChange}
                className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                disabled={submitLoading || loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={submitLoading || loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            
            {formData.password && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Password strength:</span>
                  <span className={`font-medium ${
                    passwordStrength.strength >= 4 ? 'text-green-600' :
                    passwordStrength.strength >= 3 ? 'text-blue-600' :
                    passwordStrength.strength >= 2 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                disabled={submitLoading || loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                disabled={submitLoading || loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={setAcceptTerms}
                disabled={submitLoading || loading}
              />
              <Label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-800">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-800">
                  Privacy Policy
                </Link>
              </Label>
            </div>
            {errors.terms && (
              <p className="text-sm text-red-600">{errors.terms}</p>
            )}

            <div className="flex items-start space-x-2">
              <Checkbox
                id="newsletter"
                checked={acceptNewsletter}
                onCheckedChange={setAcceptNewsletter}
                disabled={submitLoading || loading}
              />
              <Label htmlFor="newsletter" className="text-sm text-gray-600">
                Send me tips and updates about LinkedIn optimization
              </Label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={submitLoading || loading}
          >
            {submitLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or sign up with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleGoogleSignup}
            disabled={submitLoading || loading}
            className="w-full"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
          
          <Button
            variant="outline"
            onClick={handleLinkedInSignup}
            disabled={submitLoading || loading}
            className="w-full"
          >
            <LinkedinIcon className="mr-2 h-4 w-4" />
            LinkedIn
          </Button>
        </div>

        <div className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegisterForm;