import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTenant } from './TenantContext';
import { api } from '../services/apiService';
import { ShieldAlert, Utensils, Flame, CreditCard, UserCheck } from 'lucide-react';

const RolesContext = createContext();

// Paleta de estilos determinista por índice del rol
const BADGE_PALETTE = ['badge-danger', 'badge-info', 'badge-warning', 'badge-success', 'badge-muted'];
const AVATAR_PALETTE = ['avatar-admin', 'avatar-mesero', 'avatar-cocina', 'avatar-cajero', 'avatar-default'];
const ICON_PALETTE = [ShieldAlert, Utensils, Flame, CreditCard, UserCheck];
const ROLE_DOTS = ['dot-red', 'dot-blue', 'dot-orange', 'dot-green', 'dot-gray'];
const ROLE_PILLS = ['role-pill-admin', 'role-pill-mesero', 'role-pill-cocina', 'role-pill-cajero', 'role-pill-default'];

export function RolesProvider({ children }) {
  const { tenantSlug, loadingTenant, tenantError } = useTenant();
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    if (loadingTenant || tenantError) {
      if (tenantError) setLoadingRoles(false);
      return;
    }
    
    // El tenant ya está listo, podemos consultar los roles
    api.get('/auth/roles-public', { headers: { 'X-Tenant-Slug': tenantSlug } })
      .then(res => {
        setRoles(res);
      })
      .catch(err => {
        console.error('Error al cargar roles de la BD:', err);
      })
      .finally(() => {
        setLoadingRoles(false);
      });
  }, [tenantSlug, loadingTenant, tenantError]);

  const getRoleById = (id) => roles.find(r => String(r.id) === String(id));
  
  const getRoleIndex = (id) => {
    const idx = roles.findIndex(r => String(r.id) === String(id));
    return idx >= 0 ? idx : roles.length; // fallback index
  };

  const getRoleBadgeClass = (id) => BADGE_PALETTE[getRoleIndex(id) % BADGE_PALETTE.length];
  const getAvatarClass = (id) => AVATAR_PALETTE[getRoleIndex(id) % AVATAR_PALETTE.length];
  const getRoleIcon = (id) => {
    const Icon = ICON_PALETTE[getRoleIndex(id) % ICON_PALETTE.length];
    return <Icon size={26} />;
  };
  const getRoleDotClass = (id) => ROLE_DOTS[getRoleIndex(id) % ROLE_DOTS.length];
  const getRolePillClass = (id) => ROLE_PILLS[getRoleIndex(id) % ROLE_PILLS.length];

  return (
    <RolesContext.Provider value={{
      roles,
      loadingRoles,
      getRoleById,
      getRoleBadgeClass,
      getAvatarClass,
      getRoleIcon,
      getRoleDotClass,
      getRolePillClass
    }}>
      {children}
    </RolesContext.Provider>
  );
}

export function useRoles() {
  return useContext(RolesContext);
}
