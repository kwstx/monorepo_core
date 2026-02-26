export enum EntityType {
    AGENT = 'AGENT',
    USER = 'USER',
    DEPARTMENT = 'DEPARTMENT',
    ROLE = 'ROLE'
}

export enum RelationshipType {
    REPORTS_TO = 'REPORTS_TO',
    MEMBER_OF = 'MEMBER_OF',
    PART_OF = 'PART_OF', // For sub-departments
    DELEGATED_TO = 'DELEGATED_TO',
    APPROVES_FOR = 'APPROVES_FOR',
    HAS_ROLE = 'HAS_ROLE'
}

export interface PermissionScope {
    resources: string[];
    actions: string[];
}

export interface GraphRelationship {
    fromId: string;
    toId: string;
    type: RelationshipType;
    scope?: PermissionScope;
    metadata?: Record<string, any>;
}

export interface GraphNode {
    id: string;
    type: EntityType;
    name: string;
    metadata?: Record<string, any>;
}

export interface AuthorityInheritance {
    direct: PermissionScope[];
    inherited: PermissionScope[];
    delegated: PermissionScope[];
}

export interface DelegationRequest {
    sourceId: string;
    targetId: string;
    scope: PermissionScope;
}
