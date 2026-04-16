import { useState, useEffect } from 'react';

/**
 * useDebounce — delays updating a value until after a delay
 * Usage: const debouncedSearch = useDebounce(searchTerm, 500)
 */
export const useDebounce = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
