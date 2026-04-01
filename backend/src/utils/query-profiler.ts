import { Model, Document, PipelineStage } from 'mongoose';
import { logger } from '../config/logger';

export interface QueryProfile {
  operation: string;
  collection: string;
  executionTimeMs: number;
  documentCount?: number;
  stages?: PipelineStage[];
  explainResult?: any;
  timestamp: Date;
}

export interface ExplainResult {
  stage: string;
  executionTimeMillisEstimate: number;
  totalDocsExamined: number;
  totalKeysExamined: number;
  nReturned: number;
  indexName?: string;
  direction?: string;
}

/**
 * Profiler for MongoDB queries with performance monitoring
 */
export class QueryProfiler {
  private static profiles: QueryProfile[] = [];
  private static maxProfiles = 100;

  /**
   * Profile an aggregation pipeline execution
   */
  static async profileAggregation<T extends Document>(
    model: Model<T>,
    pipeline: PipelineStage[],
    operationName: string,
    options?: { explain?: boolean; logLevel?: 'debug' | 'info' | 'warn' | 'error' }
  ): Promise<any[]> {
    const startTime = performance.now();
    const collectionName = model.collection.name;

    try {
      // Execute the aggregation
      const result = await model.aggregate(pipeline).exec();
      
      const executionTime = performance.now() - startTime;
      
      // Get explain plan if requested
      let explainResult: any;
      if (options?.explain) {
        try {
          explainResult = await model.aggregate(pipeline).explain('executionStats');
        } catch (err) {
          logger.warn({ err, operation: operationName }, 'Failed to get explain plan');
        }
      }

      const profile: QueryProfile = {
        operation: operationName,
        collection: collectionName,
        executionTimeMs: Math.round(executionTime),
        documentCount: result.length,
        stages: pipeline,
        explainResult,
        timestamp: new Date(),
      };

      this.addProfile(profile);
      
      const logLevel = options?.logLevel ?? (executionTime > 100 ? 'warn' : 'debug');
      this.logProfile(profile, logLevel);

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error({
        error,
        operation: operationName,
        collection: collectionName,
        executionTimeMs: Math.round(executionTime),
        pipeline,
      }, 'Aggregation failed');
      throw error;
    }
  }

  /**
   * Profile a regular query execution
   */
  static async profileQuery<T extends Document>(
    model: Model<T>,
    queryFn: () => Promise<any>,
    operationName: string,
    options?: { logLevel?: 'debug' | 'info' | 'warn' | 'error' }
  ): Promise<any> {
    const startTime = performance.now();
    const collectionName = model.collection.name;

    try {
      const result = await queryFn();
      const executionTime = performance.now() - startTime;

      const profile: QueryProfile = {
        operation: operationName,
        collection: collectionName,
        executionTimeMs: Math.round(executionTime),
        documentCount: Array.isArray(result) ? result.length : result ? 1 : 0,
        timestamp: new Date(),
      };

      this.addProfile(profile);
      
      const logLevel = options?.logLevel ?? (executionTime > 100 ? 'warn' : 'debug');
      this.logProfile(profile, logLevel);

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      logger.error({
        error,
        operation: operationName,
        collection: collectionName,
        executionTimeMs: Math.round(executionTime),
      }, 'Query failed');
      throw error;
    }
  }

  /**
   * Get explain plan for an aggregation without executing
   */
  static async explainAggregation<T extends Document>(
    model: Model<T>,
    pipeline: PipelineStage[],
    verbosity: 'queryPlanner' | 'executionStats' | 'allPlansExecution' = 'executionStats'
  ): Promise<any> {
    try {
      return await model.aggregate(pipeline).explain(verbosity);
    } catch (error) {
      logger.error({ error, pipeline }, 'Failed to get explain plan');
      throw error;
    }
  }

  /**
   * Get all stored profiles
   */
  static getProfiles(): QueryProfile[] {
    return [...this.profiles];
  }

  /**
   * Get slow queries (execution time > threshold)
   */
  static getSlowQueries(thresholdMs: number = 100): QueryProfile[] {
    return this.profiles.filter(p => p.executionTimeMs > thresholdMs);
  }

  /**
   * Clear all profiles
   */
  static clearProfiles(): void {
    this.profiles = [];
  }

  /**
   * Get performance statistics
   */
  static getStats(): {
    totalQueries: number;
    averageTimeMs: number;
    slowQueries: number;
    collectionStats: Record<string, { count: number; avgTime: number }>;
  } {
    if (this.profiles.length === 0) {
      return {
        totalQueries: 0,
        averageTimeMs: 0,
        slowQueries: 0,
        collectionStats: {},
      };
    }

    const totalTime = this.profiles.reduce((sum, p) => sum + p.executionTimeMs, 0);
    const slowQueries = this.profiles.filter(p => p.executionTimeMs > 100).length;

    // Calculate per-collection stats
    const collectionMap = new Map<string, { total: number; count: number }>();
    for (const profile of this.profiles) {
      const current = collectionMap.get(profile.collection) ?? { total: 0, count: 0 };
      current.total += profile.executionTimeMs;
      current.count++;
      collectionMap.set(profile.collection, current);
    }

    const collectionStats: Record<string, { count: number; avgTime: number }> = {};
    for (const [collection, stats] of collectionMap) {
      collectionStats[collection] = {
        count: stats.count,
        avgTime: Math.round(stats.total / stats.count),
      };
    }

    return {
      totalQueries: this.profiles.length,
      averageTimeMs: Math.round(totalTime / this.profiles.length),
      slowQueries,
      collectionStats,
    };
  }

  private static addProfile(profile: QueryProfile): void {
    this.profiles.push(profile);
    if (this.profiles.length > this.maxProfiles) {
      this.profiles.shift();
    }
  }

  private static logProfile(
    profile: QueryProfile,
    level: 'debug' | 'info' | 'warn' | 'error'
  ): void {
    const logData = {
      operation: profile.operation,
      collection: profile.collection,
      executionTimeMs: profile.executionTimeMs,
      documentCount: profile.documentCount,
    };

    switch (level) {
      case 'debug':
        logger.debug(logData, 'Query executed');
        break;
      case 'info':
        logger.info(logData, 'Query executed');
        break;
      case 'warn':
        logger.warn(logData, 'Slow query detected');
        break;
      case 'error':
        logger.error(logData, 'Query error');
        break;
    }
  }
}

/**
 * Decorator for profiling repository methods
 */
export function ProfileQuery(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const name = operationName ?? `${target.constructor.name}.${propertyKey}`;
      const startTime = performance.now();

      try {
        const result = await originalMethod.apply(this, args);
        const executionTime = performance.now() - startTime;

        logger.debug({
          operation: name,
          executionTimeMs: Math.round(executionTime),
        }, 'Repository method executed');

        return result;
      } catch (error) {
        const executionTime = performance.now() - startTime;
        logger.error({
          error,
          operation: name,
          executionTimeMs: Math.round(executionTime),
        }, 'Repository method failed');
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility to analyze index usage from explain result
 */
export function analyzeIndexUsage(explainResult: any): {
  usesIndex: boolean;
  indexName?: string;
  stage: string;
  docsExamined: number;
  docsReturned: number;
  efficiency: number;
} {
  const executionStats = explainResult?.executionStats ?? explainResult;
  
  const docsExamined = executionStats?.totalDocsExamined ?? 0;
  const docsReturned = executionStats?.nReturned ?? 0;
  const stage = explainResult?.queryPlanner?.winningPlan?.stage ?? 
                explainResult?.stages?.[0]?.$cursor?.stage ?? 'UNKNOWN';
  const indexName = explainResult?.queryPlanner?.winningPlan?.inputStage?.indexName;

  // Calculate efficiency (lower is better - ratio of docs examined to returned)
  const efficiency = docsReturned > 0 ? docsExamined / docsReturned : docsExamined;

  return {
    usesIndex: stage === 'IXSCAN' || !!indexName,
    indexName,
    stage,
    docsExamined,
    docsReturned,
    efficiency,
  };
}
