import { createContext, useContext, useState, type ReactNode } from 'react';
import * as api from '../api';
import type { NewAccount } from '../types';
import { decodePayload, type JwtPayload } from './jwt';

/** The localStorage key of the token. */
export const TOKEN_KEY = 'token';

/** What useAuth() returns. */
export interface Auth {
  /** null: logged out. */
  token: string | null;
  /** Read from the token, for display only. null: logged out. */
  user: JwtPayload | null;
  /** True once the API refused the token, until the next login: the login page says so. */
  sessionEnded: boolean;
  /** Lets the ApiError through: 401 for wrong credentials. */
  login: (email: string, password: string) => Promise<void>;
  /** Creates a student account and logs it in. Lets the ApiError through: 400 or 409. */
  register: (account: NewAccount) => Promise<void>;
  logout: () => void;
  /** Logs out after the API refused the token. */
  endSession: () => void;
}

const AuthContext = createContext<Auth | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/** The logged-in user. The token is kept in localStorage so that it survives a reload. */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [sessionEnded, setSessionEnded] = useState(false);

  const user = token ? decodePayload(token) : null;

  const keep = (newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setSessionEnded(false);
  };

  const login = async (email: string, password: string) => {
    keep(await api.login(email, password));
  };

  const register = async (account: NewAccount) => {
    keep(await api.register(account));
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  const endSession = () => {
    logout();
    setSessionEnded(true);
  };

  return (
    <AuthContext value={{ token, user, sessionEnded, login, register, logout, endSession }}>{children}</AuthContext>
  );
};

/** The logged-in user, from any component under <AuthProvider>. */
export const useAuth = (): Auth => {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return auth;
};
