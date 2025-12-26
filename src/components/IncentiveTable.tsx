import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { calculateIncentive, type IncentiveData } from '../utils/calculator';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface IncentiveTableProps {
    data: IncentiveData[];
    thresholds?: Record<string, [number, number, number]>;
    isEditable?: boolean;
    onUpdateRow?: (index: number, field: keyof IncentiveData, value: any) => void;
    onDeleteRow?: (index: number) => void;
}

export function IncentiveTable({ data, thresholds, isEditable = false, onUpdateRow, onDeleteRow }: IncentiveTableProps) {
    const employees = useLiveQuery(() => db.employees.toArray());

    const results = data.map(row => {
        const employee = employees?.find(e => e.name === row.name);
        return {
            ...row,
            result: calculateIncentive(row, employee, thresholds)
        };
    });

    const handleInputChange = (index: number, field: keyof IncentiveData, value: string) => {
        if (!onUpdateRow) return;

        let parsedValue: any = value;
        if (field === 'netSales' || field === 'profitMargin') {
            parsedValue = Number(value.replace(/,/g, ''));
            if (isNaN(parsedValue)) parsedValue = 0;
        }

        onUpdateRow(index, field, parsedValue);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">인센티브 계산 결과</h2>
                    <p className="text-sm text-gray-500">총 {results.length}명 처리 완료</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">총 급여 지급액</p>
                    <p className="text-2xl font-bold text-blue-600">{results.reduce((sum, r) => sum + r.result.totalSalary, 0).toLocaleString()} 원</p>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">점포</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직급</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구분</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">순매출액</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">매익율</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">최대구간</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">배수율</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">인센티브</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">기본급</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">총 급여</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                            {isEditable && <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((row, idx) => {
                            const employee = employees?.find(e => e.name === row.name);
                            return (
                                <tr key={idx} className={clsx(
                                    "hover:bg-gray-50 transition-colors",
                                    row.result.message ? "bg-red-50" : ""
                                )}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
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
                                        {employee?.storeName || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isEditable ? (
                                            <select
                                                value={row.position}
                                                onChange={(e) => handleInputChange(idx, 'position', e.target.value)}
                                                className="w-24 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="공장장">공장장</option>
                                                <option value="팀장">팀장</option>
                                                <option value="선임기사">선임기사</option>
                                                <option value="기사">기사</option>
                                                <option value="수습">수습</option>
                                                <option value="기타">기타</option>
                                            </select>
                                        ) : row.position}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {isEditable ? (
                                            <input
                                                type="text"
                                                value={row.category}
                                                onChange={(e) => handleInputChange(idx, 'category', e.target.value)}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        ) : row.category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                                        {isEditable ? (
                                            <input
                                                type="number"
                                                value={row.netSales}
                                                onChange={(e) => handleInputChange(idx, 'netSales', e.target.value)}
                                                className="w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                            />
                                        ) : row.netSales.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                                        {row.result.baseSalary.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                        {row.result.totalSalary.toLocaleString()}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
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
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
