import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react';

interface MonthlyRecord {
    id: number;
    year: number;
    month: number;
    total_revenue: number;
    total_incentive: number;
    total_profit: number;
    employee_count: number;
    created_at: string;
}

interface IncentiveDetail {
    id: number;
    employee_name: string;
    position: string;
    store_name: string;
    net_sales: number;
    profit_margin: number;
    incentive_amount: number;
    level: number;
    multiplier: number;
}

export function HistoryPage() {
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // Fetch History
    const { data: records, isLoading } = useQuery({
        queryKey: ['history'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('monthly_records')
                .select('*')
                .order('year', { ascending: false })
                .order('month', { ascending: false });
            if (error) throw error;
            return data as MonthlyRecord[];
        }
    });

    // Fetch Details for Expanded Record
    const { data: details } = useQuery({
        queryKey: ['history-details', expandedId],
        queryFn: async () => {
            if (!expandedId) return [];
            const { data, error } = await supabase
                .from('incentive_details')
                .select('*')
                .eq('record_id', expandedId)
                .order('incentive_amount', { ascending: false });
            if (error) throw error;
            return data as IncentiveDetail[];
        },
        enabled: !!expandedId
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase
                .from('monthly_records')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            setExpandedId(null);
        },
        onError: (error) => {
            console.error('Delete failed:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    });

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">히스토리 (Cloud)</h2>

            <div className="space-y-4">
                {records?.map((record) => (
                    <div key={record.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div
                            onClick={() => toggleExpand(record.id)}
                            className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{record.year}년 {record.month}월</h3>
                                    <p className="text-sm text-gray-500">
                                        {new Date(record.created_at).toLocaleDateString()} 저장 • {record.employee_count}명
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">총 매출액</p>
                                    <p className="font-medium text-gray-900">{record.total_revenue.toLocaleString()}원</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500">총 인센티브</p>
                                    <p className="font-bold text-blue-600">{record.total_incentive.toLocaleString()}원</p>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, record.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                >
                                    <Trash2 size={20} />
                                </button>
                                {expandedId === record.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                            </div>
                        </div>

                        {expandedId === record.id && (
                            <div className="border-t border-gray-200 bg-gray-50 p-6">
                                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직급</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">점포</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">순매출액</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">매출이익</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">인센티브</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">단계</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {details?.map((detail) => (
                                                <tr key={detail.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{detail.employee_name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{detail.position}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{detail.store_name || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-900">{detail.net_sales.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                                                        {(detail.net_sales * (detail.profit_margin / 100)).toLocaleString()}
                                                        <span className="text-xs ml-1">({detail.profit_margin}%)</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">{detail.incentive_amount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${detail.level > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {detail.level > 0 ? `${detail.level}단계` : '미달성'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {records?.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500">저장된 기록이 없습니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
