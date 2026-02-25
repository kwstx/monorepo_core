export interface IdentityUserProfile {
    id: string;
    email?: string;
    displayName?: string;
    departmentId?: string;
}

export interface IdentityRole {
    id: string;
    name: string;
    parentRoleId?: string;
}

export interface DepartmentNode {
    id: string;
    name: string;
    parentDepartmentId?: string;
}

export interface PermissionScope {
    resource: string;
    actions: string[];
    constraints?: Record<string, unknown>;
}

export interface IdentityContextRecord {
    user: IdentityUserProfile;
    roleIds: string[];
    departmentId?: string;
}

export interface IdentityClaimSet {
    subject: {
        id: string;
        email?: string;
        displayName?: string;
    };
    roles: {
        assigned: string[];
        resolved: string[];
    };
    departments: {
        activeDepartmentId?: string;
        lineage: string[];
    };
    permissionScopes: PermissionScope[];
    source: {
        ssoProvider?: string;
        directoryProvider?: string;
        rbacProvider?: string;
        synchronizedAt: number;
    };
}

export interface SSOAdapter {
    providerName: string;
    fetchUser(userId: string): Promise<IdentityUserProfile | null>;
}

export interface DirectoryAdapter {
    providerName: string;
    fetchDepartments(): Promise<DepartmentNode[]>;
    fetchUserDepartment(userId: string): Promise<string | undefined>;
}

export interface RBACAdapter {
    providerName: string;
    fetchUserRoleIds(userId: string): Promise<string[]>;
    fetchRoleCatalog(): Promise<IdentityRole[]>;
    fetchPermissionScopesByRole(): Promise<Record<string, PermissionScope[]>>;
}

export interface IdentityIntegrationLayerOptions {
    sso?: SSOAdapter;
    directory?: DirectoryAdapter;
    rbac?: RBACAdapter;
}

export class IdentityIntegrationLayer {
    private readonly sso?: SSOAdapter;
    private readonly directory?: DirectoryAdapter;
    private readonly rbac?: RBACAdapter;

    constructor(options: IdentityIntegrationLayerOptions) {
        this.sso = options.sso;
        this.directory = options.directory;
        this.rbac = options.rbac;
    }

    async synchronizeIdentityClaims(userId: string): Promise<IdentityClaimSet> {
        const userPromise = this.sso?.fetchUser(userId) ?? Promise.resolve(null);
        const departmentTreePromise =
            this.directory?.fetchDepartments() ?? Promise.resolve<DepartmentNode[]>([]);
        const userDepartmentPromise =
            this.directory?.fetchUserDepartment(userId) ?? Promise.resolve(undefined);
        const roleIdsPromise = this.rbac?.fetchUserRoleIds(userId) ?? Promise.resolve<string[]>([]);
        const roleCatalogPromise = this.rbac?.fetchRoleCatalog() ?? Promise.resolve<IdentityRole[]>([]);
        const permissionMapPromise =
            this.rbac?.fetchPermissionScopesByRole() ?? Promise.resolve<Record<string, PermissionScope[]>>({});

        const [userRecord, departments, userDepartmentId, assignedRoleIds, roleCatalog, permissionMap] =
            await Promise.all([
                userPromise,
                departmentTreePromise,
                userDepartmentPromise,
                roleIdsPromise,
                roleCatalogPromise,
                permissionMapPromise
            ]);

        const user: IdentityUserProfile = userRecord ?? { id: userId };
        const contextRecord: IdentityContextRecord = {
            user,
            roleIds: assignedRoleIds,
            departmentId: user.departmentId ?? userDepartmentId
        };

        const resolvedRoleIds = this.resolveRoleHierarchy(contextRecord.roleIds, roleCatalog);
        const permissionScopes = this.resolvePermissionScopes(resolvedRoleIds, permissionMap);
        const departmentLineage = this.resolveDepartmentLineage(
            contextRecord.departmentId,
            departments
        );

        return {
            subject: {
                id: contextRecord.user.id,
                email: contextRecord.user.email,
                displayName: contextRecord.user.displayName
            },
            roles: {
                assigned: [...contextRecord.roleIds],
                resolved: resolvedRoleIds
            },
            departments: {
                activeDepartmentId: contextRecord.departmentId,
                lineage: departmentLineage
            },
            permissionScopes,
            source: {
                ssoProvider: this.sso?.providerName,
                directoryProvider: this.directory?.providerName,
                rbacProvider: this.rbac?.providerName,
                synchronizedAt: Date.now()
            }
        };
    }

    private resolveRoleHierarchy(
        assignedRoleIds: string[],
        roleCatalog: IdentityRole[]
    ): string[] {
        const roleById = new Map<string, IdentityRole>(roleCatalog.map((role) => [role.id, role]));
        const resolved = new Set<string>();

        const visit = (roleId: string, guard: Set<string>) => {
            if (resolved.has(roleId)) {
                return;
            }
            if (guard.has(roleId)) {
                return;
            }

            guard.add(roleId);
            resolved.add(roleId);

            const role = roleById.get(roleId);
            if (role?.parentRoleId) {
                visit(role.parentRoleId, guard);
            }
            guard.delete(roleId);
        };

        for (const roleId of assignedRoleIds) {
            visit(roleId, new Set<string>());
        }

        return [...resolved];
    }

    private resolvePermissionScopes(
        roleIds: string[],
        permissionMap: Record<string, PermissionScope[]>
    ): PermissionScope[] {
        const index = new Map<string, PermissionScope>();

        for (const roleId of roleIds) {
            const roleScopes = permissionMap[roleId] ?? [];
            for (const scope of roleScopes) {
                const key = `${scope.resource}::${scope.actions.slice().sort().join(',')}`;
                const existing = index.get(key);
                if (!existing) {
                    index.set(key, {
                        resource: scope.resource,
                        actions: [...scope.actions].sort(),
                        constraints: scope.constraints
                    });
                    continue;
                }

                if (scope.constraints && existing.constraints) {
                    existing.constraints = { ...existing.constraints, ...scope.constraints };
                } else if (scope.constraints) {
                    existing.constraints = { ...scope.constraints };
                }
            }
        }

        return [...index.values()];
    }

    private resolveDepartmentLineage(
        activeDepartmentId: string | undefined,
        departments: DepartmentNode[]
    ): string[] {
        if (!activeDepartmentId) {
            return [];
        }

        const departmentById = new Map<string, DepartmentNode>(
            departments.map((department) => [department.id, department])
        );

        const lineage: string[] = [];
        let cursor: string | undefined = activeDepartmentId;
        const guard = new Set<string>();

        while (cursor && !guard.has(cursor)) {
            guard.add(cursor);
            lineage.push(cursor);
            cursor = departmentById.get(cursor)?.parentDepartmentId;
        }

        return lineage;
    }
}
