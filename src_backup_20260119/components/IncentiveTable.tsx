import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { calculateIncentive, type IncentiveData } from '../utils/calculator';
import { AlertCircle, CheckCircle2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useMemo } from 'react';

interface IncentiveTableProps {
    data: IncentiveData[];
    thresholds?: Record<string, [number, number, number]>;
    isEditable?: boolean;
    onUpdateRow?: (index: number, field: keyof IncentiveData, value: any) => void;
    onDeleteRow?: (index: number) => void;
    employees?: any[]; // Allow passing employees directly (e.g. from Supabase)
    positions?: Record<string, string[]>;
}

export function IncentiveTable({ data, thresholds, isEditable = false, onUpdateRow, onDeleteRow, employees: propEmployees, positions }: IncentiveTableProps) {
    const localEmployees = useLiveQuery(() => db.employees.toArray());
    const employees = propEmployees || localEmployees;

    // --- Sort & Filter State ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        name: '',
        store: '',
        position: ''
    });

    // --- Derived Data ---
    const processedData = useMemo(() => {
        let processed = data.map(row => {
            const employee = employees?.find(e => e.name === row.name);
            return {
                ...row,
                storeName: employee?.store_name || '-',
                result: calculateIncentive(row, employee, thresholds)
            };
        });

        // 1. Filter
        if (filters.name) {
            processed = processed.filter(row => row.name.includes(filters.name));
        }
        if (filters.store) {
            processed = processed.filter(row => row.storeName.includes(filters.store));
        }
        if (filters.position) {
            processed = processed.filter(row => row.position.includes(filters.position));
        }

        // 2. Sort
        if (sortConfig) {
            processed.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];

                // Handle nested result properties
                if (sortConfig.key.startsWith('result.')) {
                    const key = sortConfig.key.split('.')[1];
                    aValue = a.result[key as keyof typeof a.result];
                    bValue = b.result[key as keyof typeof b.result];
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processed;
    }, [data, employees, thresholds, sortConfig, filters]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-blue-600" />
            : <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    const handleInputChange = (index: number, field: keyof IncentiveData, value: string) => {
        if (!onUpdateRow) return;

        let parsedValue: any = value;
        if (field === 'netSales' || field === 'profitMargin' || field === 'additionalSales') {
            parsedValue = Number(value.replace(/,/g, ''));
            if (isNaN(parsedValue)) parsedValue = 0;
        }

        onUpdateRow(index, field, parsedValue);
    };

    const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(null);

    const toggleExpand = (index: number) => {
        setExpandedRowIndex(expandedRowIndex === index ? null : index);
    };

    return (
        <div className="space-y-6">
            {/* ... (existing filter controls) */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">인센티브 계산 결과</h2>
                        <p className="text-sm text-gray-500">총 {processedData.length}명 (전체 {data.length}명)</p>
                    </div>
                    {/* Filter Controls */}
                    <div className="flex gap-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="이름 검색"
                                value={filters.name}
                                onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-2 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="부서 필터"
                                value={filters.store}
                                onChange={e => setFilters(prev => ({ ...prev, store: e.target.value }))}
                                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                            />
                        </div>
                        <select
                            value={filters.position}
                            onChange={e => setFilters(prev => ({ ...prev, position: e.target.value }))}
                            className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            <option value="">전체 직급</option>
                            <option value="공장장">공장장</option>
                            <option value="팀장">팀장</option>
                            <option value="선임기사">선임기사</option>
                            <option value="기사">기사</option>
                            <option value="수습">수습</option>
                            <option value="기타">기타</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="w-8 px-3 py-3"></th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('name')}
                            >
                                <div className="flex items-center">이름 <SortIcon column="name" /></div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('storeName')}
                            >
                                <div className="flex items-center">부서 <SortIcon column="storeName" /></div>
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('position')}
                            >
                                <div className="flex items-center">직급 <SortIcon column="position" /></div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구분</th>
                            <th
                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('netSales')}
                            >
                                <div className="flex items-center justify-end">순매출액 <SortIcon column="netSales" /></div>
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">추가매출액</th>
                            <th
                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('profitMargin')}
                            >
                                <div className="flex items-center justify-end">매익율 <SortIcon column="profitMargin" /></div>
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">최대구간</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">배수율</th>
                            <th
                                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('result.incentive')}
                            >
                                <div className="flex items-center justify-end">인센티브 <SortIcon column="result.incentive" /></div>
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                            {isEditable && <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {processedData.map((row, idx) => {
                            const employee = employees?.find(e => e.name === row.name);
                            const isExpanded = expandedRowIndex === idx;

                            return (
                                <>
                                    <tr
                                        key={idx}
                                        className={clsx(
                                            "hover:bg-gray-50 transition-colors cursor-pointer",
                                            !employee ? "bg-yellow-50" : "", // Highlight unknown employee
                                            row.result.message ? "bg-red-50" : "",
                                            isExpanded ? "bg-blue-50" : ""
                                        )}
                                        onClick={() => toggleExpand(idx)}
                                    >
                                        <td className="px-3 py-4 text-center">
                                            {isExpanded ? <ArrowUp size={16} className="text-gray-400" /> : <ArrowDown size={16} className="text-gray-400" />}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={(e) => handleInputChange(idx, 'name', e.target.value)}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            ) : row.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {row.storeName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <select
                                                    value={row.position}
                                                    onChange={(e) => handleInputChange(idx, 'position', e.target.value)}
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                >
                                                    {positions ? (
                                                        Object.entries(positions).flatMap(([_, posList]) => posList).map(pos => (
                                                            <option key={pos} value={pos}>{pos}</option>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <option value="공장장">공장장</option>
                                                            <option value="팀장">팀장</option>
                                                            <option value="선임기사">선임기사</option>
                                                            <option value="기사">기사</option>
                                                            <option value="수습">수습</option>
                                                            <option value="기타">기타</option>
                                                        </>
                                                    )}
                                                    {/* Add current value if not in list to avoid hidden selection */}
                                                    {row.position && positions && !Object.values(positions).flat().includes(row.position) && (
                                                        <option value={row.position}>{row.position}</option>
                                                    )}
                                                </select>
                                            ) : row.position}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <input
                                                    type="text"
                                                    value={row.category}
                                                    onChange={(e) => handleInputChange(idx, 'category', e.target.value)}
                                                    className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            ) : row.category}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <input
                                                    type="number"
                                                    value={row.netSales}
                                                    onChange={(e) => handleInputChange(idx, 'netSales', e.target.value)}
                                                    className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                                />
                                            ) : row.netSales.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <input
                                                    type="number"
                                                    value={row.additionalSales || 0}
                                                    onChange={(e) => handleInputChange(idx, 'additionalSales', e.target.value)}
                                                    className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                                />
                                            ) : (row.additionalSales || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono" onClick={e => e.stopPropagation()}>
                                            {isEditable ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number"
                                                        value={row.profitMargin}
                                                        onChange={(e) => handleInputChange(idx, 'profitMargin', e.target.value)}
                                                        className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                                        step="0.1"
                                                    />
                                                    <span>%</span>
                                                </div>
                                            ) : `${row.profitMargin}%`}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {row.result.level > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    {row.result.level}단계
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {row.result.multiplier > 0 ? `${Math.round(row.result.multiplier * 100)}%` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                                            {row.result.incentive.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            {row.result.message ? (
                                                <div className="flex items-center justify-center text-red-500" title={row.result.message}>
                                                    <AlertCircle size={18} className="mr-1" />
                                                    <span className="text-xs">{row.result.message}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center text-green-500">
                                                    <CheckCircle2 size={18} />
                                                </div>
                                            )}
                                        </td>
                                        {isEditable && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => onDeleteRow && onDeleteRow(idx)}
                                                    className="text-gray-400 hover:text-red-600 transition-colors"
                                                    title="행 삭제"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                    {isExpanded && row.result.breakdown && row.result.breakdown.length > 0 && (
                                        <tr className="bg-blue-50/50">
                                            <td colSpan={13} className="px-6 py-4">
                                                <div className="bg-white rounded-lg border border-blue-100 p-4 shadow-inner">
                                                    <h4 className="text-sm font-bold text-gray-700 mb-3">인센티브 계산 상세</h4>
                                                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 border-b border-gray-100 pb-2 mb-2">
                                                        <div className="col-span-1">단계</div>
                                                        <div className="col-span-3">구간</div>
                                                        <div className="col-span-2 text-right">적용 매출</div>
                                                        <div className="col-span-2 text-right">요율</div>
                                                        <div className="col-span-2 text-right">배수</div>
                                                        <div className="col-span-2 text-right">계산액</div>
                                                    </div>
                                                    {row.result.breakdown.map((item, i) => (
                                                        <div key={i} className="grid grid-cols-12 gap-4 text-sm text-gray-700 py-1.5 border-b border-gray-50 last:border-0">
                                                            <div className="col-span-1 font-medium text-blue-600">{item.level}단계</div>
                                                            <div className="col-span-3 text-gray-500">
                                                                {item.min.toLocaleString()} ~ {item.max ? item.max.toLocaleString() : '∞'}
                                                            </div>
                                                            <div className="col-span-2 text-right font-mono">{item.salesAmount.toLocaleString()}</div>
                                                            <div className="col-span-2 text-right text-gray-500">{(item.rate * 100).toFixed(1)}%</div>
                                                            <div className="col-span-2 text-right text-gray-500">{(row.result.multiplier * 100).toFixed(0)}%</div>
                                                            <div className="col-span-2 text-right font-bold text-blue-600">{item.incentiveAmount.toLocaleString()}</div>
                                                        </div>
                                                    ))}
                                                    <div className="grid grid-cols-12 gap-4 text-sm font-bold text-gray-900 pt-3 mt-2 border-t border-gray-200">
                                                        <div className="col-span-10 text-right">합계</div>
                                                        <div className="col-span-2 text-right text-blue-700">
                                                            {row.result.breakdown.reduce((sum, item) => sum + item.incentiveAmount, 0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
