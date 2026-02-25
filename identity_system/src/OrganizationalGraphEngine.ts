import {
    GraphNode,
    GraphRelationship,
    RelationshipType,
    EntityType,
    PermissionScope,
    DelegationRequest
} from './orgGraphTypes';

export class OrganizationalGraphEngine {
    private nodes: Map<string, GraphNode> = new Map();
    private outEdges: Map<string, GraphRelationship[]> = new Map();
    private inEdges: Map<string, GraphRelationship[]> = new Map();

    public addNode(node: GraphNode): void {
        this.nodes.set(node.id, node);
    }

    public addRelationship(rel: GraphRelationship): void {
        if (!this.nodes.has(rel.fromId) || !this.nodes.has(rel.toId)) {
            throw new Error(`Nodes ${rel.fromId} or ${rel.toId} do not exist.`);
        }

        const out = this.outEdges.get(rel.fromId) ?? [];
        out.push(rel);
        this.outEdges.set(rel.fromId, out);

        const inv = this.inEdges.get(rel.toId) ?? [];
        inv.push(rel);
        this.inEdges.set(rel.toId, inv);
    }

    /**
     * Returns the full reporting chain from the entity up to the root.
     */
    public getReportingChain(entityId: string): string[] {
        const chain: string[] = [];
        let current = entityId;
        const seen = new Set<string>();

        while (current && !seen.has(current)) {
            seen.add(current);
            const reportRel: GraphRelationship | undefined = this.outEdges.get(current)?.find(r => r.type === RelationshipType.REPORTS_TO);
            if (reportRel) {
                chain.push(reportRel.toId);
                current = reportRel.toId;
            } else {
                break;
            }
        }
        return chain;
    }

    /**
     * Resolves the department lineage for an entity.
     */
    public getDepartmentLineage(entityId: string): string[] {
        const lineage: string[] = [];
        let current: string | undefined;

        // If the entity itself is a department, start from it directly.
        const entityNode = this.nodes.get(entityId);
        if (entityNode?.type === EntityType.DEPARTMENT) {
            current = entityId;
        } else {
            // Otherwise resolve the direct department membership first.
            const directDept = this.outEdges.get(entityId)?.find(r => r.type === RelationshipType.MEMBER_OF)?.toId;
            if (!directDept) return [];
            current = directDept;
        }

        const seen = new Set<string>();
        while (current && !seen.has(current)) {
            seen.add(current);
            lineage.push(current);
            const partOfRel: GraphRelationship | undefined = this.outEdges.get(current)?.find(r => r.type === RelationshipType.PART_OF);
            current = partOfRel?.toId;
        }

        return lineage;
    }

    /**
     * Checks if a subject has the authority for a specific action on a resource.
     * Considers direct scope, inherited scope from roles, and delegated authority.
     */
    public isAuthorized(subjectId: string, action: string, resource: string): boolean {
        const effectiveScopes = this.getEffectiveAuthority(subjectId);

        return effectiveScopes.some(scope =>
            (scope.resources.includes('*') || scope.resources.includes(resource)) &&
            (scope.actions.includes('*') || scope.actions.includes(action))
        );
    }

    /**
     * Calculates the total effective authority for an entity.
     */
    public getEffectiveAuthority(entityId: string): PermissionScope[] {
        const scopes: PermissionScope[] = [];
        const visited = new Set<string>();
        this.traverseAuthority(entityId, visited, scopes);
        return scopes;
    }

    private traverseAuthority(currentId: string, visited: Set<string>, scopes: PermissionScope[]): void {
        if (visited.has(currentId)) return;
        visited.add(currentId);

        const node = this.nodes.get(currentId);
        if (!node) return;

        // 1. Get scopes from HAS_ROLE relationships
        const roleRels = this.outEdges.get(currentId)?.filter(r => r.type === RelationshipType.HAS_ROLE) ?? [];
        for (const rel of roleRels) {
            const roleNode = this.nodes.get(rel.toId);
            if (roleNode && roleNode.metadata?.scope) {
                scopes.push(roleNode.metadata.scope);
            }
            // Recurse into role inheritance if defined
            this.traverseAuthority(rel.toId, visited, scopes);
        }

        // 2. Get scopes from delegation
        const delegatedRels = this.inEdges.get(currentId)?.filter(r => r.type === RelationshipType.DELEGATED_TO) ?? [];
        for (const rel of delegatedRels) {
            if (rel.scope) {
                scopes.push(rel.scope);
            }
        }

        // 3. Inheritance from direct metadata
        if (node.metadata?.scope) {
            scopes.push(node.metadata.scope);
        }
    }

    /**
     * Validates if a source can delegate a specific scope to a target.
     * Rule: Source must already have the authority they are delegating.
     */
    public validateDelegation(request: DelegationRequest): boolean {
        const sourceScopes = this.getEffectiveAuthority(request.sourceId);

        // Ensure every resource/action in the request scope is covered by source scopes
        for (const res of request.scope.resources) {
            for (const action of request.scope.actions) {
                const hasAuth = sourceScopes.some(s =>
                    (s.resources.includes('*') || s.resources.includes(res)) &&
                    (s.actions.includes('*') || s.actions.includes(action))
                );
                if (!hasAuth) return false;
            }
        }

        return true;
    }

    /**
     * Finds who needs to approve an action crossing unit boundaries.
     */
    public getRequiredApprovers(subjectId: string, resourceOwnerId: string): string[] {
        const subDeptLineage = this.getDepartmentLineage(subjectId);
        const resDeptLineage = this.getDepartmentLineage(resourceOwnerId);

        // If they are in the same department branch, maybe no extra approval is needed
        // but if they are in different major departments, we need cross-functional approval
        const commonDept = subDeptLineage.find(d => resDeptLineage.includes(d));

        if (commonDept && subDeptLineage[0] === resDeptLineage[0]) {
            // Same micro-department
            return [];
        }

        // Cross-unit boundary detected. 
        // Look for APPROVES_FOR relationships for the target department
        const targetDept = resDeptLineage[0];
        const approvers = this.inEdges.get(targetDept)
            ?.filter(r => r.type === RelationshipType.APPROVES_FOR)
            .map(r => r.fromId) ?? [];

        return approvers;
    }
}
