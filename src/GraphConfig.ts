export interface EntityConfig {
    entity: string;
    name: string;
    shadow: boolean;
};

export class GraphConfig {
    title: string;
    autorefresh: string;
    shadow: boolean;
    entities: EntityConfig[];

    constructor(obj) {
        obj && Object.assign(this, obj);
    }

    public validate() {
        if (!this.entities) {
            throw new Error('Please define an entity!');
        }
    }

    public getEntityById(entityId: string): EntityConfig {
        for (const entity of this.entities) {
            if (entity.entity == entityId) {
                return entity;
            }
        }
        throw Error("EntityId not found: " + entityId);
    }

    public getEntityByName(name: string): EntityConfig {
        for (const entity of this.entities) {
            if (entity.name == name) {
                return entity;
            }
        }
        throw Error("Entity name not found: " + name);
    }
}
