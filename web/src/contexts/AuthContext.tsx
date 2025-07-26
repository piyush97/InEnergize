import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionLevel: 'free' | 'basic' | 'premium' | 'enterprise';
  linkedinConnected: boolean;
  profilePicture?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  connectLinkedIn: () => Promise<void>;
  disconnectLinkedIn: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  const verifyToken = useCallback(async (authToken: string) => {
    try {
      const response = await fetch('/api/v1/auth/verify', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      if (data.success) {
        setUser(data.data.user);
        setToken(authToken);
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      handleLogout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for existing authentication on mount
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, [verifyToken]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.success) {
        const { user: userData, token: authToken } = data.data;
        
        setUser(userData);
        setToken(authToken);
        
        // Store in localStorage
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      if (data.success) {
        const { user: newUser, token: authToken } = data.data;
        
        setUser(newUser);
        setToken(authToken);
        
        // Store in localStorage
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('user', JSON.stringify(newUser));
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    handleLogout();
  };

  const refreshToken = async (): Promise<void> => {
    try {
      const currentToken = token || localStorage.getItem('authToken');
      if (!currentToken) {
        throw new Error('No token available');
      }

      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      if (data.success) {
        const { token: newToken } = data.data;
        setToken(newToken);
        localStorage.setItem('authToken', newToken);
      } else {
        throw new Error(data.error || 'Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      handleLogout();
      throw error;
    }
  };

  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const connectLinkedIn = async (): Promise<void> => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      // Start LinkedIn OAuth flow
      const response = await fetch('/api/v1/linkedin/oauth/authorize', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'LinkedIn connection failed');
      }

      if (data.success && data.data.authUrl) {
        // Redirect to LinkedIn OAuth
        window.location.href = data.data.authUrl;
      } else {
        throw new Error('Failed to get LinkedIn authorization URL');
      }
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      throw error;
    }
  };

  const disconnectLinkedIn = async (): Promise<void> => {
    try {
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/v1/linkedin/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'LinkedIn disconnection failed');
      }

      if (data.success) {
        updateUser({ linkedinConnected: false });
      } else {
        throw new Error(data.error || 'LinkedIn disconnection failed');
      }
    } catch (error) {
      console.error('LinkedIn disconnection error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    connectLinkedIn,
    disconnectLinkedIn
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;