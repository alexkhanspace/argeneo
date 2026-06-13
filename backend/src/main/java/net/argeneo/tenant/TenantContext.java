package net.argeneo.tenant;

import java.util.function.Supplier;

/**
 * Porte le tenant courant pour le thread de requête.
 *
 * <p>Alimenté par le filtre d'authentification à partir du JWT, puis lu par le
 * {@link TenantIdentifierResolver} d'Hibernate qui applique automatiquement
 * l'isolation {@code tenant_id} sur toutes les entités annotées {@code @TenantId}.</p>
 */
public final class TenantContext {

    /** Sentinelle « aucun tenant courant » (contexte plateforme / pré-login). */
    public static final Long ROOT = -1L;

    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(Long tenantId) {
        CURRENT.set(tenantId);
    }

    /** Tenant courant, ou {@code null} si aucun. */
    public static Long get() {
        return CURRENT.get();
    }

    /** Tenant courant, ou {@link #ROOT} si aucun (jamais {@code null}). */
    public static Long getOrRoot() {
        Long current = CURRENT.get();
        return current != null ? current : ROOT;
    }

    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Exécute une action en se plaçant temporairement dans un tenant donné,
     * puis restaure le contexte précédent. Utilisé par le Super-Admin quand il
     * agit pour le compte d'un tenant (ex. créer le patron d'un nouveau tenant).
     */
    public static <T> T runAs(Long tenantId, Supplier<T> action) {
        Long previous = CURRENT.get();
        CURRENT.set(tenantId);
        try {
            return action.get();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }
}
