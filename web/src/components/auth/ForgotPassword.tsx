import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ForgotPasswordProps {
  onSuccess?: () => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email address is required');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      if (data.success) {
        setSuccess(true);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(data.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) {
      setError('');
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            We've sent a password reset link to:
          </p>
          <p className="font-medium text-gray-900">{email}</p>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="mb-2"><strong>Next steps:</strong></p>
            <ul className="text-left space-y-1">
              <li>• Check your email inbox (and spam folder)</li>
              <li>• Click the reset link within 1 hour</li>
              <li>• Create your new password</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => setSuccess(false)}
              variant="outline"
              className="w-full"
            >
              Send Another Email
            </Button>
            
            <Link href="/auth/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Reset Your Password
        </CardTitle>
        <p className="text-center text-gray-600">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={handleEmailChange}
                className={`pl-10 ${error ? 'border-red-500' : ''}`}
                disabled={loading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Reset Link...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Reset Link
              </>
            )}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
          
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ForgotPassword;