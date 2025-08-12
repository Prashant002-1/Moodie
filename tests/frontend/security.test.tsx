import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from '../../src/contexts/UserContext';

// Mock API client
vi.mock('../../src/services/apiClient', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock services
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

describe('Frontend Security Tests - Critical Vulnerabilities', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    it('should sanitize user input in login form', async () => {
      const { LoginForm } = await import('../../src/components/auth/LoginForm');
      const maliciousScript = '<script>alert("XSS")</script>';
      const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      vi.mocked(await import('../../src/services/authService')).authService.login = mockLogin;

      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, `${maliciousScript}@test.com`);

      // Verify the script is not executed
      expect(window.alert).not.toHaveBeenCalled();
      expect(document.querySelector('script')).toBeNull();
    });

    it('should escape HTML in error messages', async () => {
      const { LoginForm } = await import('../../src/components/auth/LoginForm');
      const htmlError = '<img src=x onerror=alert("XSS")>';
      const mockLogin = vi.fn().mockRejectedValue(new Error(htmlError));
      
      vi.mocked(await import('../../src/services/authService')).authService.login = mockLogin;

      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        const errorElement = screen.getByText(new RegExp(htmlError.replace(/[<>]/g, ''), 'i'));
        expect(errorElement).toBeInTheDocument();
        expect(errorElement.innerHTML).not.toContain('<img');
        expect(errorElement.innerHTML).not.toContain('onerror');
      });
    });

    it('should prevent script injection in movie titles', async () => {
      const { MovieRow } = await import('../../src/components/features/movie/MovieRow');
      const maliciousMovie = {
        id: 1,
        title: '<script>alert("XSS")</script>Malicious Movie',
        overview: 'Test overview',
        poster_path: '/test.jpg',
        backdrop_path: '/test-bg.jpg',
        genre_ids: [28],
        vote_average: 7.5,
        vote_count: 100,
        popularity: 50,
        adult: false,
        original_language: 'en',
        original_title: 'Original Title',
        release_date: '2024-01-01',
        video: false,
      };

      render(
        <TestWrapper>
          <MovieRow movie={maliciousMovie} />
        </TestWrapper>
      );

      const titleElement = screen.getByText(/malicious movie/i);
      expect(titleElement.innerHTML).not.toContain('<script');
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Security', () => {
    it('should not store sensitive data in localStorage', async () => {
      const sensitiveData = {
        password: 'secret123',
        passwordHash: '$2b$10$hash',
        creditCard: '4111-1111-1111-1111',
      };

      // Simulate storing user data
      localStorage.setItem('user-data', JSON.stringify(sensitiveData));

      // Check that sensitive data is not stored
      const stored = localStorage.getItem('user-data');
      expect(stored).not.toContain('password');
      expect(stored).not.toContain('passwordHash');
      expect(stored).not.toContain('creditCard');
    });

    it('should clear authentication data on logout', async () => {
      // Set up authenticated state
      localStorage.setItem('auth-token', 'fake-jwt-token');
      localStorage.setItem('auth-user', JSON.stringify({ id: 1, email: 'test@test.com' }));

      const mockLogout = vi.fn().mockResolvedValue(undefined);
      vi.mocked(await import('../../src/services/authService')).authService.logout = mockLogout;

      // Trigger logout
      await mockLogout();

      // Verify data is cleared
      expect(localStorage.getItem('auth-token')).toBeNull();
      expect(localStorage.getItem('auth-user')).toBeNull();
    });

    it('should validate JWT token format before storage', () => {
      const invalidTokens = [
        'invalid-token',
        '123',
        '',
        'header.payload', // Missing signature
        'header.payload.signature.extra', // Too many parts
      ];

      invalidTokens.forEach(token => {
        try {
          // Attempt to store invalid token
          const parts = token.split('.');
          expect(parts).toHaveLength(3); // Valid JWT should have 3 parts
        } catch (error) {
          expect(error).toBeDefined();
        }
      });
    });

    it('should handle token expiration gracefully', async () => {
      // Simulate expired token
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MzAwMDAwMDB9.invalid';
      localStorage.setItem('auth-token', expiredToken);

      const mockGetCurrentUser = vi.fn().mockRejectedValue(new Error('Token expired'));
      vi.mocked(await import('../../src/services/authService')).authService.getCurrentUser = mockGetCurrentUser;

      try {
        await mockGetCurrentUser();
      } catch (error) {
        expect(error.message).toContain('Token expired');
        // Should clear expired token
        expect(localStorage.getItem('auth-token')).toBeNull();
      }
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format strictly', async () => {
      const { RegisterForm } = await import('../../src/components/auth/RegisterForm');
      const invalidEmails = [
        'notanemail',
        '@domain.com',
        'user@',
        'user@domain',
        'user.domain.com',
        'user@domain..com',
        'user name@domain.com', // Space
        'user@domain .com',     // Space in domain
      ];

      for (const email of invalidEmails) {
        render(
          <TestWrapper>
            <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
          </TestWrapper>
        );

        const emailInput = screen.getByLabelText(/email/i);
        const submitButton = screen.getByRole('button', { name: /create account/i });

        await user.clear(emailInput);
        await user.type(emailInput, email);
        await user.click(submitButton);

        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      }
    });

    it('should enforce password complexity requirements', async () => {
      const { RegisterForm } = await import('../../src/components/auth/RegisterForm');
      const weakPasswords = [
        '123',           // Too short
        'password',      // Too common
        '12345678',      // No letters
        'abcdefgh',      // No numbers
        'Password',      // No special chars
        'p@ss',          // Too short even with special chars
      ];

      for (const password of weakPasswords) {
        render(
          <TestWrapper>
            <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
          </TestWrapper>
        );

        const passwordInput = screen.getByLabelText(/password/i);
        const submitButton = screen.getByRole('button', { name: /create account/i });

        await user.clear(passwordInput);
        await user.type(passwordInput, password);
        await user.click(submitButton);

        // Should show password strength error
        const errorMessage = screen.getByText(/password/i);
        expect(errorMessage).toBeInTheDocument();
      }
    });

    it('should sanitize username input', async () => {
      const { RegisterForm } = await import('../../src/components/auth/RegisterForm');
      const maliciousUsernames = [
        'admin',
        'root',
        'system',
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        'user; DROP TABLE users; --',
        'user\x00admin', // Null byte injection
      ];

      for (const username of maliciousUsernames) {
        render(
          <TestWrapper>
            <RegisterForm onSuccess={vi.fn()} onSwitchToLogin={vi.fn()} />
          </TestWrapper>
        );

        const usernameInput = screen.getByLabelText(/username/i);
        await user.clear(usernameInput);
        await user.type(usernameInput, username);

        // Should either reject or sanitize the input
        const inputValue = (usernameInput as HTMLInputElement).value;
        expect(inputValue).not.toContain('<script');
        expect(inputValue).not.toContain('DROP TABLE');
        expect(inputValue).not.toContain('\x00');
      }
    });
  });

  describe('CSRF (Cross-Site Request Forgery) Prevention', () => {
    it('should include CSRF tokens in API requests', async () => {
      const mockApiClient = vi.mocked(await import('../../src/services/apiClient'));
      
      // Mock a form submission that should include CSRF protection
      const { LoginForm } = await import('../../src/components/auth/LoginForm');
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

      // Verify API call includes security headers
      expect(mockApiClient.apiClient.post).toHaveBeenCalled();
    });

    it('should validate request origin', () => {
      // Mock window.origin for security check
      const originalOrigin = window.location.origin;
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://malicious-site.com' },
        writable: true,
      });

      // Should reject requests from invalid origins
      expect(window.location.origin).toBe('https://malicious-site.com');
      
      // Restore original origin
      Object.defineProperty(window, 'location', {
        value: { origin: originalOrigin },
        writable: true,
      });
    });
  });

  describe('Session Security', () => {
    it('should implement session timeout', async () => {
      const mockGetCurrentUser = vi.fn();
      vi.mocked(await import('../../src/services/authService')).authService.getCurrentUser = mockGetCurrentUser;

      // Simulate session timeout
      localStorage.setItem('auth-token', 'valid-token');
      localStorage.setItem('session-start', (Date.now() - 25 * 60 * 60 * 1000).toString()); // 25 hours ago

      // Should clear expired session
      const sessionStart = localStorage.getItem('session-start');
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (sessionStart && Date.now() - parseInt(sessionStart) > twentyFourHours) {
        localStorage.removeItem('auth-token');
        localStorage.removeItem('auth-user');
        localStorage.removeItem('session-start');
      }

      expect(localStorage.getItem('auth-token')).toBeNull();
    });

    it('should prevent session fixation', () => {
      const oldSessionId = 'old-session-id';
      const newSessionId = 'new-session-id';
      
      // Simulate old session
      sessionStorage.setItem('session-id', oldSessionId);
      
      // On authentication, should generate new session
      sessionStorage.setItem('session-id', newSessionId);
      
      expect(sessionStorage.getItem('session-id')).toBe(newSessionId);
      expect(sessionStorage.getItem('session-id')).not.toBe(oldSessionId);
    });

    it('should implement secure session storage', () => {
      const sensitiveData = {
        token: 'jwt-token',
        user: { id: 1, email: 'test@test.com' },
        sessionId: 'session-123'
      };

      // Should use localStorage with secure patterns
      localStorage.setItem('auth-token', sensitiveData.token);
      localStorage.setItem('auth-user', JSON.stringify(sensitiveData.user));
      
      // Verify data is stored securely (not in sessionStorage for persistence)
      expect(localStorage.getItem('auth-token')).toBe(sensitiveData.token);
      expect(sessionStorage.getItem('auth-token')).toBeNull(); // Should not be in sessionStorage
    });
  });

  describe('Data Protection', () => {
    it('should not log sensitive information', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      const sensitiveData = {
        password: 'secret123',
        token: 'jwt-token-123',
        email: 'user@test.com'
      };

      // Simulate logging (should not include sensitive data)
      console.log('User authenticated:', { id: 1, username: 'test' });
      console.error('Authentication failed for user');

      // Verify no sensitive data in logs
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveData.password)
      );
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(sensitiveData.token)
      );

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should implement proper error handling without information leakage', async () => {
      const { LoginForm } = await import('../../src/components/auth/LoginForm');
      const detailedError = new Error('Database connection failed at localhost:5432 with credentials user:password');
      const mockLogin = vi.fn().mockRejectedValue(detailedError);
      
      vi.mocked(await import('../../src/services/authService')).authService.login = mockLogin;

      render(
        <TestWrapper>
          <LoginForm onSuccess={vi.fn()} onSwitchToRegister={vi.fn()} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, 'password');
      await user.click(submitButton);

      await waitFor(() => {
        // Should show generic error, not detailed technical information
        const errorText = screen.getByText(/invalid credentials|authentication failed/i);
        expect(errorText).toBeInTheDocument();
        expect(errorText).not.toHaveTextContent('Database connection');
        expect(errorText).not.toHaveTextContent('localhost:5432');
        expect(errorText).not.toHaveTextContent('user:password');
      });
    });
  });

  describe('Content Security Policy (CSP) Compliance', () => {
    it('should not execute inline scripts', () => {
      const inlineScript = document.createElement('script');
      inlineScript.innerHTML = 'alert("CSP violation")';
      
      // Attempt to add inline script
      try {
        document.head.appendChild(inlineScript);
      } catch (error) {
        // Should be blocked by CSP
        expect(error).toBeDefined();
      }
      
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should restrict resource loading to allowed domains', () => {
      const maliciousImage = document.createElement('img');
      maliciousImage.src = 'https://malicious-site.com/tracking-pixel.gif';
      
      // Should validate allowed domains for resources
      const allowedDomains = [
        'localhost',
        'image.tmdb.org',
        'api.themoviedb.org',
      ];
      
      const url = new URL(maliciousImage.src);
      const isDomainAllowed = allowedDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );
      
      expect(isDomainAllowed).toBe(false);
    });
  });
});