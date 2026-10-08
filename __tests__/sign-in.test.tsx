import { render, screen, userEvent } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import SignInScreen from '@/app/sign-in';
import { supabase } from '@/lib/supabase';

const auth = jest.mocked(supabase.auth);

async function fill(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  if (email) await user.type(screen.getByPlaceholderText('Email'), email);
  if (password) await user.type(screen.getByPlaceholderText('Password'), password);
}

describe('Sign in', () => {
  it('opens on sign-in by default', async () => {
    await render(<SignInScreen />);

    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeOnTheScreen();
  });

  it('opens on sign-up when asked to (from "Get started")', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mode: 'sign-up' });
    await render(<SignInScreen />);

    expect(screen.getByText('Create account')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeOnTheScreen();
  });

  it('switches between sign-in and sign-up', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);

    await user.press(screen.getByRole('button', { name: "Don't have an account? Sign up" }));
    expect(screen.getByText('Create account')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  });

  it('asks for both fields before contacting the server', async () => {
    const user = userEvent.setup();
    await render(<SignInScreen />);

    await fill(user, 'me@example.com', '');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Enter your email and password.')).toBeOnTheScreen();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);
    const user = userEvent.setup();
    await render(<SignInScreen />);

    await fill(user, '  me@example.com ', 'hunter2hunter2');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'hunter2hunter2',
    });
  });

  it('shows the server message when sign-in is refused', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    } as never);
    const user = userEvent.setup();
    await render(<SignInScreen />);

    await fill(user, 'me@example.com', 'wrong-password');
    await user.press(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid login credentials')).toBeOnTheScreen();
  });

  it('after sign-up, asks to confirm by email and returns to sign-in', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ mode: 'sign-up' });
    auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null } as never);
    const user = userEvent.setup();
    await render(<SignInScreen />);

    await fill(user, 'new@example.com', 'a-good-password');
    await user.press(screen.getByRole('button', { name: 'Sign Up' }));

    expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'a-good-password' });
    expect(await screen.findByText('Check your email to confirm your account, then sign in.')).toBeOnTheScreen();
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  });
});
