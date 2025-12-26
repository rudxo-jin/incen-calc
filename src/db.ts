import Dexie, { type EntityTable } from 'dexie';

export interface Employee {
    id: number;
    name: string;
    position: string; // '팀장', '선임기사', '기사', etc.
    storeName?: string; // Store name for statistics
    type: 'incentive' | 'basic'; // 'incentive' (Standard) or 'basic' (Basic Salary Only)
    baseSalary: number; // For basic salary employees, or just reference
    isActive: boolean;
}

export interface MonthlyRecord {
    id: number;
    year: number;
    month: number;
    totalRevenue: number;
    totalIncentive: number;
    totalProfit: number;
    employeeCount: number;
    createdAt: Date;
}

export interface IncentiveDetail {
    id: number;
    recordId: number; // Foreign key to MonthlyRecord
    employeeName: string;
    position: string;
    storeName?: string; // Store name for statistics
    category: string;
    netSales: number;
    profitMargin: number;
    incentiveAmount: number;
    level: number;
    multiplier: number;
}

export interface AppSettings {
    id: number; // Singleton, always 1
    thresholds: Record<string, [number, number, number]>; // Position -> [Base, L1, L2]
    rates: number[]; // [0.03, 0.07, 0.10]
    baseDeductibles: Record<string, number>;
    stores: string[]; // List of configured store names
}

const db = new Dexie('IncentiveDB') as Dexie & {
    employees: EntityTable<Employee, 'id'>;
    monthlyRecords: EntityTable<MonthlyRecord, 'id'>;
    incentiveDetails: EntityTable<IncentiveDetail, 'id'>;
    settings: EntityTable<AppSettings, 'id'>;
};

// Schema definition
db.version(1).stores({
    employees: '++id, name, position, isActive',
    monthlyRecords: '++id, [year+month], createdAt',
    incentiveDetails: '++id, recordId, employeeName',
    settings: '++id'
});

export { db };
