import { useState, useEffect } from 'react';

/**
 * useLocalStorage — persists state to localStorage
 * Usage: const [theme, setTheme] = useLocalStorage('theme', 'light')
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) {
      console.error('useLocalStorage error:', err);
    }
  };

  return [storedValue, setValue];
};

export default useLocalStorage;
