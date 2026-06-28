package net.argeneo.iam.service;

import net.argeneo.iam.domain.DashboardLayout;
import net.argeneo.iam.repository.DashboardLayoutRepository;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lecture/écriture du tableau de bord personnalisé du principal courant. */
@Service
public class DashboardLayoutService {

    private final DashboardLayoutRepository repository;

    public DashboardLayoutService(DashboardLayoutRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public String get() {
        AuthPrincipal me = CurrentUser.require();
        return repository.findByPrincipalTypeAndPrincipalId(me.type().name(), me.id())
                .map(DashboardLayout::getLayout)
                .orElse(null);
    }

    @Transactional
    public String save(String layout) {
        AuthPrincipal me = CurrentUser.require();
        DashboardLayout entity = repository
                .findByPrincipalTypeAndPrincipalId(me.type().name(), me.id())
                .orElseGet(() -> {
                    DashboardLayout d = new DashboardLayout();
                    d.setPrincipalType(me.type().name());
                    d.setPrincipalId(me.id());
                    return d;
                });
        entity.setLayout(layout);
        return repository.save(entity).getLayout();
    }
}
