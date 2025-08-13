import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from '../../src/components/auth/AuthModal';
import LoginForm from '../../src/components/auth/LoginForm';
import RegisterForm from '../../src/components/auth/RegisterForm';
import { UserProvider } from '../../src/contexts/UserContext';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { BrowserRouter } from 'react-router-dom';

// Mock auth service
vi.mock('../../src/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <ThemeProvider>
      <UserProvider>
        {children}
      </UserProvider>
    </ThemeProvider>
  </BrowserRouter>
);

describe('Frontend Authentication - UI Components', () => {
  const user = userEvent.setup();
  let mockAuthService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthService = (await import('../../src/services/authService')).authService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AuthModal Component', () => {
    it('should render modal when open', () => {
      render(
        <TestWrapper>
          <AuthModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(
        <TestWrapper>
          <AuthModal isOpen={false} onClose={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });
  });

  describe('LoginForm Component', () => {
    it('should render login form fields', () => {
      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

  });

  describe('RegisterForm Component', () => {
    it('should render registration form fields', () => {
      render(
        <TestWrapper>
          <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/choose a username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

  });
});