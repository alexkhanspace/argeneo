package net.argeneo.tenant;

import org.hibernate.context.spi.CurrentTenantIdentifierResolver;

/**
 * Resolver Hibernate (multitenancy par discriminateur) : fournit le tenant
 * courant à chaque session à partir du {@link TenantContext}.
 *
 * <p>Instancié par Hibernate (constructeur sans argument) via la propriété
 * {@code hibernate.tenant_identifier_resolver} — il ne dépend d'aucun bean Spring.</p>
 */
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<Long> {

    @Override
    public Long resolveCurrentTenantIdentifier() {
        return TenantContext.getOrRoot();
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
