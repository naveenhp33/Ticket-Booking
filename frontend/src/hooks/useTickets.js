import { useState, useEffect, useCallback, useRef } from 'react';
import { ticketService } from '../services/ticketService';

/**
 * useTickets — reusable hook for fetching paginated, filtered tickets
 * Usage: const { tickets, loading, pagination, setFilter, refresh } = useTickets({ status: 'open' })
 */
export const useTickets = (initialFilters = {}) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1 });
  const [filters, setFiltersState] = useState({
    page: 1,
    limit: 20,
    sortBy: 'priorityScore',
    sortOrder: 'desc',
    ...initialFilters
  });

  const abortRef = useRef(null);

  const fetchTickets = useCallback(async (currentFilters) => {
    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const params = {};
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) params[k] = v;
      });

      const res = await ticketService.getAll(params);
      setTickets(res.data.tickets);
      setPagination(res.data.pagination);
    } catch (err) {
      if (err.name !== 'CanceledError') {
        setError(err.response?.data?.message || 'Failed to load tickets');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets(filters);
  }, [filters, fetchTickets]);

  const setFilter = useCallback((key, value) => {
    setFiltersState(prev => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  }, []);

  const setFilters = useCallback((newFilters) => {
    setFiltersState(prev => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const refresh = useCallback(() => {
    fetchTickets(filters);
  }, [filters, fetchTickets]);

  return { tickets, loading, error, pagination, filters, setFilter, setFilters, refresh };
};

export default useTickets;
