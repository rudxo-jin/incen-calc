import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface StoreStat {
    storeName: string;
    employeeCount: number;
    netSales: number;
    grossProfit: number;
    totalIncentive: number;
    baseSalary: number;
    totalLaborCost: number;
    laborShare: number;
}

export function StatisticsPage() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [selectedStore, setSelectedStore] = useState<string | null>(null);

    // Fetch monthly record to get the ID
    const { data: record } = useQuery({
        queryKey: ['monthly_record', year, month],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('monthly_records')
                .select('*')
                .eq('year', year)
                .eq('month', month)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
            return data;
        }
    });

    // Fetch details for that record
    const { data: details } = useQuery({
        queryKey: ['incentive_details', record?.id],
        queryFn: async () => {
            if (!record?.id) return [];
            const { data, error } = await supabase
                .from('incentive_details')
                .select('*')
                .eq('record_id', record.id);
            if (error) throw error;
            return data;
        },
        enabled: !!record?.id
    });

    // Fetch current employees to get base salary
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('*');
            if (error) throw error;
            return data;
        }
    });

    if (!record || !details || !employees) {
        return (
            <div className="space-y-8">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-900">점포별 통계 (Cloud)</h2>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-transparent outline-none font-medium text-gray-700"
                        >
                            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                                <option key={y} value={y}>{y}년</option>
                            ))}
                        </select>
                        <span className="text-gray-400">|</span>
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-transparent outline-none font-medium text-gray-700"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{m}월</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="bg-white p-12 rounded-xl text-center text-gray-500 border border-gray-200 border-dashed">
                    해당 월의 데이터가 없습니다.
                </div>
            </div>
        );
    }

    // Process Data
    const statsMap = new Map<string, StoreStat>();

    details.forEach(detail => {
        const storeName = detail.store_name || '미지정';
        const currentStat = statsMap.get(storeName) || {
            storeName,
            employeeCount: 0,
            netSales: 0,
            grossProfit: 0,
            totalIncentive: 0,
            baseSalary: 0,
            totalLaborCost: 0,
            laborShare: 0
        };

        const emp = employees.find(e => e.name === detail.employee_name);
        const baseSalary = emp ? emp.base_salary : 0;

        // Calculate Gross Profit: Net Sales * (Margin / 100)
        const profit = detail.net_sales * (detail.profit_margin / 100);

        currentStat.employeeCount += 1;
        currentStat.netSales += detail.net_sales;
        currentStat.grossProfit += profit;
        currentStat.totalIncentive += detail.incentive_amount;
        currentStat.baseSalary += baseSalary;
        currentStat.totalLaborCost += (detail.incentive_amount + baseSalary);

        statsMap.set(storeName, currentStat);
    });

    // Calculate Ratios
    const stats = Array.from(statsMap.values()).map(stat => ({
        ...stat,
        laborShare: stat.grossProfit > 0 ? (stat.totalLaborCost / stat.grossProfit) * 100 : 0
    })).sort((a, b) => b.netSales - a.netSales); // Sort by Sales desc

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">점포별 통계 (Cloud)</h2>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                    <select
                        value={year}
                        onChange={(e) => { setYear(Number(e.target.value)); setSelectedStore(null); }}
                        className="bg-transparent outline-none font-medium text-gray-700"
                    >
                        {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
                    </select>
                    <span className="text-gray-400">|</span>
                    <select
                        value={month}
                        onChange={(e) => { setMonth(Number(e.target.value)); setSelectedStore(null); }}
                        className="bg-transparent outline-none font-medium text-gray-700"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">점포별 매출 및 이익 (단위: 천원)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="storeName" />
                                <YAxis tickFormatter={(value) => (value / 1000).toLocaleString()} />
                                <Tooltip formatter={(value: any) => value ? `${(Number(value) / 1000).toLocaleString()} 천원` : ''} />
                                <Legend />
                                <Bar dataKey="netSales" name="순매출액" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="grossProfit" name="매출이익" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">노동분배율 (%)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="storeName" />
                                <YAxis unit="%" />
                                <Tooltip formatter={(value: any) => value ? `${Number(value).toFixed(1)}%` : ''} />
                                <Legend />
                                <Bar dataKey="laborShare" name="노동분배율" fill="#F59E0B" radius={[4, 4, 0, 0]}>
                                    {stats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.laborShare > 50 ? '#EF4444' : '#F59E0B'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-gray-900">점포별 현황 (클릭하여 상세 보기)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">점포명</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">인원</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">순매출액</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">매출이익</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">인센티브</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">총 인건비(추정)</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">노동분배율</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stats.map((stat) => (
                                <>
                                    <tr
                                        key={stat.storeName}
                                        onClick={() => setSelectedStore(selectedStore === stat.storeName ? null : stat.storeName)}
                                        className={`cursor-pointer transition-colors ${selectedStore === stat.storeName ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{stat.storeName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-gray-500">{stat.employeeCount}명</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">{Math.round(stat.netSales).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-medium">{Math.round(stat.grossProfit).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-blue-600">{Math.round(stat.totalIncentive).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">{Math.round(stat.totalLaborCost).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${stat.laborShare > 50 ? 'bg-red-100 text-red-800' :
                                                stat.laborShare > 40 ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                {stat.laborShare.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                    {selectedStore === stat.storeName && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={7} className="p-4">
                                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-inner">
                                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                        <thead className="bg-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-medium text-gray-500">이름</th>
                                                                <th className="px-4 py-2 text-left font-medium text-gray-500">직급</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-500">순매출액</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-500">매출이익</th>
                                                                <th className="px-4 py-2 text-right font-medium text-blue-600">인센티브</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-500">총 급여</th>
                                                                <th className="px-4 py-2 text-center font-medium text-gray-500">노동분배율</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {details
                                                                ?.filter((d: any) => (d.store_name || '미지정') === stat.storeName)
                                                                .map((detail: any) => {
                                                                    const emp = employees.find((e: any) => e.name === detail.employee_name);
                                                                    const baseSalary = emp ? emp.base_salary : 0;
                                                                    const grossProfit = detail.net_sales * (detail.profit_margin / 100);
                                                                    const totalSalary = detail.incentive_amount + baseSalary;
                                                                    const laborShare = grossProfit > 0 ? (totalSalary / grossProfit) * 100 : 0;

                                                                    return (
                                                                        <tr key={detail.id} className="hover:bg-gray-50">
                                                                            <td className="px-4 py-2 text-gray-900">{detail.employee_name}</td>
                                                                            <td className="px-4 py-2 text-gray-500">{detail.position}</td>
                                                                            <td className="px-4 py-2 text-right font-mono">{detail.net_sales.toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-right font-mono text-green-600">{Math.round(grossProfit).toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-right font-bold text-blue-600">{detail.incentive_amount.toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-right text-gray-600">{totalSalary.toLocaleString()}</td>
                                                                            <td className="px-4 py-2 text-center">
                                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${laborShare > 50 ? 'bg-red-100 text-red-800' :
                                                                                    laborShare > 40 ? 'bg-yellow-100 text-yellow-800' :
                                                                                        'bg-green-100 text-green-800'
                                                                                    }`}>
                                                                                    {laborShare.toFixed(1)}%
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold">
                            <tr>
                                <td className="px-6 py-4 text-gray-900">합계</td>
                                <td className="px-6 py-4 text-center text-gray-900">{stats.reduce((a, b) => a + b.employeeCount, 0)}명</td>
                                <td className="px-6 py-4 text-right text-gray-900">{Math.round(stats.reduce((a, b) => a + b.netSales, 0)).toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-green-600">{Math.round(stats.reduce((a, b) => a + b.grossProfit, 0)).toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-blue-600">{Math.round(stats.reduce((a, b) => a + b.totalIncentive, 0)).toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-gray-600">{Math.round(stats.reduce((a, b) => a + b.totalLaborCost, 0)).toLocaleString()}</td>
                                <td className="px-6 py-4 text-center text-gray-900">
                                    {(() => {
                                        const totalLabor = stats.reduce((a, b) => a + b.totalLaborCost, 0);
                                        const totalProfit = stats.reduce((a, b) => a + b.grossProfit, 0);
                                        return totalProfit > 0 ? (totalLabor / totalProfit * 100).toFixed(1) : '0.0';
                                    })()}%
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
