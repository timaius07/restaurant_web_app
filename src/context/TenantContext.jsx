import { createContext, useContext, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { setTenantSlug, api } from '../services/apiService';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { tenantSlug: routeSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Obtener slug de URL o localStorage o 'sodalatica' por defecto
  const effectiveSlug = routeSlug || localStorage.getItem('tenant_slug') || 'sodalatica';
  const [slug, setSlugState] = useState(effectiveSlug);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  useEffect(() => {
    if (routeSlug && routeSlug !== slug) {
      setSlugState(routeSlug);
    }
  }, [routeSlug]);

  useEffect(() => {
    if (!slug) {
      setLoadingTenant(false);
      return;
    }

    setTenantSlug(slug);

    let isMounted = true;
    async function fetchTenantDetails() {
      setLoadingTenant(true);
      setTenantError(null);
      try {
        const data = await api.get(`/public/tenant/info/${slug}`);
        if (isMounted) {
          setTenantInfo(data);
          setLoadingTenant(false);
        }
      } catch (err) {
        if (isMounted) {
          console.warn(`Info del tenant '${slug}':`, err.message);
          // Solo marcar error si la API respondió explícitamente que la soda no existe
          const errMsg = (err.response?.error || err.message || '').toLowerCase();
          if (errMsg.includes('soda no encontrada') || errMsg.includes('tenant no encontrado') || errMsg.includes('inactiva')) {
            setTenantError('Soda no encontrada o inactiva');
          } else {
            // Si el backend es una versión previa o no tiene el endpoint público montado, usar fallback no bloqueante
            setTenantInfo({
              slug,
              nombre: slug === 'sodalatica' ? 'Soda La Tica' : slug,
              workflow_type: 'estandar'
            });
          }
          setLoadingTenant(false);
        }
      }
    }

    fetchTenantDetails();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const tenantPath = (subpath = '') => {
    const cleanSub = subpath.startsWith('/') ? subpath : `/${subpath}`;
    if (!slug) return cleanSub;
    return `/${slug}${cleanSub === '/' ? '' : cleanSub}`;
  };

  const changeTenant = (newSlug) => {
    if (!newSlug) return;
    setSlugState(newSlug);
    setTenantSlug(newSlug);
    navigate(`/${newSlug}/login`);
  };

  return (
    <TenantContext.Provider value={{
      tenantSlug: slug,
      tenantInfo,
      loadingTenant,
      tenantError,
      tenantPath,
      changeTenant
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    const fallbackSlug = localStorage.getItem('tenant_slug') || 'sodalatica';
    return {
      tenantSlug: fallbackSlug,
      tenantInfo: { slug: fallbackSlug, nombre: 'Soda La Tica' },
      loadingTenant: false,
      tenantError: null,
      tenantPath: (subpath = '') => `/${fallbackSlug}${subpath.startsWith('/') ? subpath : '/' + subpath}`,
      changeTenant: () => {}
    };
  }
  return context;
}
