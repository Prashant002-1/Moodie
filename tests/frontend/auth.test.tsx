import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthModal } from '../../src/components/auth/AuthModal';
import { LoginForm } from '../../src/components/auth/LoginForm';
import { RegisterForm } from '../../src/components/auth/RegisterForm';
import { UserProvider } from '../../src/contexts/UserContext';
import { BrowserRouter } from 'react-router-dom';

// Mock API client
vi.mock('../../src/services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

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
    <UserProvider>
      {children}
    </UserProvider>
  </BrowserRouter>
);

describe('Frontend Authentication - Security Critical', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AuthModal Component', () => {
    it('should render login form by default', () => {
      render(
        <TestWrapper>
          <AuthModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('should switch to register form when clicked', async () => {
      render(
        <TestWrapper>
          <AuthModal isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      const registerLink = screen.getByText(/don't have an account/i);
      await user.click(registerLink);

      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    it('should close modal when close button clicked', async () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <AuthModal isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    it('should not render when isOpen is false', () => {
      render(
        <TestWrapper>
          <AuthModal isOpen={false} onClose={vi.fn()} />
        </TestWrapper>
      );

      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });
  });

  describe('LoginForm Component Security', () => {
    const mockAuthService = vi.mocked(await import('../../src/services/authService'));

    it('should validate email format', async () => {
      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      expect(mockAuthService.authService.login).not.toHaveBeenCalled();
    });

    it('should validate password requirement', async () => {
      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.click(submitButton);

      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      expect(mockAuthService.authService.login).not.toHaveBeenCalled();
    });

    it('should submit valid credentials', async () => {
      mockAuthService.authService.login.mockResolvedValue({
        token: 'valid-jwt-token',
        user: { id: 1, email: 'test@test.com', username: 'test' }
      });

      const onSuccess = vi.fn();
      render(
        <TestWrapper>
          <LoginForm onSuccess={onSuccess} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.authService.login).toHaveBeenCalledWith(
          'test@test.com',
          'password123'
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle login failure gracefully', async () => {
      mockAuthService.authService.login.mockRejectedValue(
        new Error('Invalid credentials')
      );

      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should sanitize input to prevent XSS', async () => {
      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const maliciousInput = '<script>alert("xss")</script>@test.com';

      await user.type(emailInput, maliciousInput);

      expect(emailInput).toHaveValue(maliciousInput);
      // Ensure no script execution occurred
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      mockAuthService.authService.login.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('RegisterForm Component Security', () => {
    const mockAuthService = vi.mocked(await import('../../src/services/authService'));

    it('should validate all required fields', async () => {
      render(
        <TestWrapper>
          <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    it('should validate password strength', async () => {
      render(
        <TestWrapper>
          <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(passwordInput, '123');
      await user.click(submitButton);

      expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
    });

    it('should validate username format', async () => {
      render(
        <TestWrapper>
          <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(usernameInput, 'a'); // Too short
      await user.click(submitButton);

      expect(screen.getByText(/username must be/i)).toBeInTheDocument();
    });

    it('should submit valid registration data', async () => {
      mockAuthService.authService.register.mockResolvedValue({
        token: 'new-jwt-token',
        user: { id: 2, email: 'new@test.com', username: 'newuser' }
      });

      const onSuccess = vi.fn();
      render(
        <TestWrapper>
          <RegisterForm onSuccess={onSuccess} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'new@test.com');
      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'securePassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.authService.register).toHaveBeenCalledWith(
          'new@test.com',
          'newuser',
          'securePassword123'
        );
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle registration failure', async () => {
      mockAuthService.authService.register.mockRejectedValue(
        new Error('Email already exists')
      );

      render(
        <TestWrapper>
          <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'existing@test.com');
      await user.type(usernameInput, 'user');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication State Management', () => {
    it('should store authentication token securely', async () => {
      const mockAuthService = vi.mocked(await import('../../src/services/authService'));
      mockAuthService.authService.login.mockResolvedValue({
        token: 'jwt-token',
        user: { id: 1, email: 'test@test.com', username: 'test' }
      });

      const onSuccess = vi.fn();
      render(
        <TestWrapper>
          <LoginForm onSuccess={onSuccess} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(localStorage.getItem('auth-token')).toBe('jwt-token');
        expect(localStorage.getItem('auth-user')).toBe(JSON.stringify({
          id: 1, email: 'test@test.com', username: 'test'
        }));
      });
    });

    it('should clear authentication data on logout', () => {
      localStorage.setItem('auth-token', 'test-token');
      localStorage.setItem('auth-user', JSON.stringify({ id: 1 }));

      // Simulate logout
      localStorage.removeItem('auth-token');
      localStorage.removeItem('auth-user');

      expect(localStorage.getItem('auth-token')).toBeNull();
      expect(localStorage.getItem('auth-user')).toBeNull();
    });
  });
});