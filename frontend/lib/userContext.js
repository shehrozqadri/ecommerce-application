"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  USER_TOKEN_KEY,
  USER_KEY,
  fetchGuestCart,
  fetchUserMe,
  STORE_AUTH_EXPIRED_EVENT,
} from "./api";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const storedToken = localStorage.getItem(USER_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);

      fetchUserMe(storedToken)
        .then((freshUser) => {
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          setUser(freshUser);
        })
        .catch((error) => {
          if (error?.isAuthError) {
            localStorage.removeItem(USER_TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
            const guestCart = fetchGuestCart();
            setCartCount(guestCart.item_count);
          }
        });
      return;
    }

    const guestCart = fetchGuestCart();
    setCartCount(guestCart.item_count);
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      localStorage.removeItem(USER_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      const guestCart = fetchGuestCart();
      setCartCount(guestCart.item_count);
    }

    window.addEventListener(STORE_AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(STORE_AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  function signIn(tokenVal, userData) {
    localStorage.setItem(USER_TOKEN_KEY, tokenVal);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    const guestCart = fetchGuestCart();
    setCartCount(guestCart.item_count);
  }

  return (
    <UserContext.Provider value={{ user, token, cartCount, setCartCount, signIn, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
