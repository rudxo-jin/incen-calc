import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { ChevronDown, ChevronUp, Trash2, FileText, Edit2, Save, X, ArrowDown, ArrowUp, Download } from 'lucide-react';
import { calculateIncentive, DEFAULT_THRESHOLDS } from '../utils/calculator';
import * as XLSX from 'xlsx';

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
    additional_sales?: number;
    category?: string; // Needed for calculation
    application_rate?: number; // 1-9
    display_col?: number; // Calculated column for display
    extra_incentives?: Record<string, number>; // Additional incentives
}

export function HistoryPage() {
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedDetails, setEditedDetails] = useState<IncentiveDetail[]>([]);

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

    // Fetch Settings for Thresholds
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error) throw error;
            return data;
        }
    });

    // Fetch Employees for Category Fallback
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase.from('employees').select('name, category');
            if (error) throw error;
            return data;
        }
    });

    // Fetch Additional Incentive Types
    const { data: additionalIncentiveTypes } = useQuery({
        queryKey: ['additional_incentive_types'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('additional_incentive_types')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as { id: number, name: string }[];
        }
    });

    // Sync details to local state when loaded or expanded
    useEffect(() => {
        if (details) {
            setEditedDetails(details);
        }
    }, [details]);

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

    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!expandedId) return;

            // 1. Update Details
            const { error: detailsError } = await supabase
                .from('incentive_details')
                .upsert(editedDetails.map(d => ({
                    id: d.id,
                    record_id: expandedId,
                    employee_name: d.employee_name,
                    position: d.position,
                    store_name: d.store_name,
                    net_sales: d.net_sales,
                    additional_sales: d.additional_sales,
                    profit_margin: d.profit_margin,
                    incentive_amount: d.incentive_amount,
                    level: d.level,
                    multiplier: d.multiplier,
                    category: d.category, // Save category
                    application_rate: d.application_rate, // Save application_rate
                    extra_incentives: d.extra_incentives // Save extra incentives
                })));

            if (detailsError) throw detailsError;

            // 2. Recalculate Totals
            let totalRevenue = 0;
            let totalIncentive = 0;
            let totalProfit = 0;

            editedDetails.forEach(d => {
                totalRevenue += d.net_sales;
                // Total Incentive = Sales Incentive + Sum of Extra Incentives
                const extraSum = Object.values(d.extra_incentives || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
                totalIncentive += d.incentive_amount + extraSum;
                totalProfit += d.net_sales * (d.profit_margin / 100);
            });

            // 3. Update Record
            const { error: recordError } = await supabase
                .from('monthly_records')
                .update({
                    total_revenue: totalRevenue,
                    total_incentive: totalIncentive,
                    total_profit: Math.round(totalProfit)
                })
                .eq('id', expandedId);

            if (recordError) throw recordError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['history'] });
            queryClient.invalidateQueries({ queryKey: ['history-details', expandedId] });
            setIsEditing(false);
            alert('저장되었습니다.');
        },
        onError: (error) => {
            console.error('Update failed:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    });

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('정말 이 기록을 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    const toggleExpand = (id: number) => {
        if (isEditing) {
            if (!confirm('수정 중인 내용이 사라집니다. 이동하시겠습니까?')) return;
            setIsEditing(false);
        }
        setExpandedId(expandedId === id ? null : id);
    };

    const handleInputChange = (id: number, field: keyof IncentiveDetail, value: string) => {
        let newValue: string | number | undefined = value;

        // Convert to number only for numeric fields
        if (field === 'net_sales' || field === 'additional_sales' || field === 'profit_margin' || field === 'application_rate') {
            const numValue = Number(value.replace(/,/g, ''));
            if (value !== '' && isNaN(numValue)) return; // Allow empty string for clearing
            newValue = value === '' && field === 'application_rate' ? undefined : numValue;
        }

        const index = editedDetails.findIndex(d => d.id === id);
        if (index === -1) return;

        const newDetails = [...editedDetails];
        // @ts-ignore
        const detail = { ...newDetails[index], [field]: newValue };

        // Recalculate Incentive
        const thresholds = settings?.thresholds || DEFAULT_THRESHOLDS;

        const calcData = {
            name: detail.employee_name,
            position: detail.position,
            category: detail.category || '택시', // Fallback
            netSales: detail.net_sales,
            additionalSales: detail.additional_sales,
            profitMargin: detail.profit_margin,
            forcedCol: detail.application_rate // Pass forced column
        };

        const result = calculateIncentive(calcData, undefined, thresholds);

        detail.incentive_amount = result.incentive;
        detail.level = result.level;
        detail.multiplier = result.multiplier;
        // Update display_col as well
        detail.display_col = result.col;

        newDetails[index] = detail;
        setEditedDetails(newDetails);
    };

    const handleExtraIncentiveChange = (id: number, typeName: string, value: string) => {
        const numValue = Number(value.replace(/,/g, ''));
        if (value !== '' && isNaN(numValue)) return;

        const index = editedDetails.findIndex(d => d.id === id);
        if (index === -1) return;

        const newDetails = [...editedDetails];
        const detail = { ...newDetails[index] };

        detail.extra_incentives = {
            ...(detail.extra_incentives || {}),
            [typeName]: value === '' ? 0 : numValue
        };

        newDetails[index] = detail;
        setEditedDetails(newDetails);
    };

    const [expandedDetailIndex, setExpandedDetailIndex] = useState<number | null>(null);

    const toggleDetailExpand = (index: number) => {
        setExpandedDetailIndex(expandedDetailIndex === index ? null : index);
    };

    // --- Filter & Sort State ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        name: '',
        store: '',
        position: ''
    });

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ArrowDown size={14} className="ml-1 text-gray-300" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-blue-600" />
            : <ArrowDown size={14} className="ml-1 text-blue-600" />;
    };

    // --- Processed Details (Filter & Sort) ---
    const processedDetails = (() => {
        const baseData = isEditing ? editedDetails : (details || []);
        const thresholds = { ...DEFAULT_THRESHOLDS, ...(settings?.thresholds || {}) };

        // Map for quick lookup
        const employeeCategoryMap = new Map(employees?.map(e => [e.name, e.category]) || []);

        let processed = baseData.map(d => {
            const category = d.category || employeeCategoryMap.get(d.employee_name) || '택시';

            // Calculate effective column for display if not already set
            let display_col = d.display_col;
            if (display_col === undefined) {
                const calcData = {
                    name: d.employee_name,
                    position: d.position,
                    category: category,
                    netSales: d.net_sales,
                    additionalSales: d.additional_sales,
                    profitMargin: d.profit_margin,
                    forcedCol: d.application_rate || undefined
                };
                const res = calculateIncentive(calcData, undefined, thresholds);
                display_col = res.col;
            }

            return {
                ...d,
                category,
                display_col
            };
        });

        // 1. Filter
        if (filters.name) {
            processed = processed.filter(d => d.employee_name.includes(filters.name));
        }
        if (filters.store) {
            processed = processed.filter(d => d.store_name?.includes(filters.store));
        }
        if (filters.position) {
            processed = processed.filter(d => d.position === filters.position);
        }

        // 2. Sort
        if (sortConfig) {
            processed.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof IncentiveDetail];
                let bValue: any = b[sortConfig.key as keyof IncentiveDetail];

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processed;
    })();

    const handleExportExcel = (record: MonthlyRecord) => {
        const thresholds = { ...DEFAULT_THRESHOLDS, ...(settings?.thresholds || {}) };

        const exportData = processedDetails.map((detail, index) => {
            const calcData = {
                name: detail.employee_name,
                position: detail.position,
                category: detail.category || '택시',
                netSales: detail.net_sales,
                additionalSales: detail.additional_sales,
                profitMargin: detail.profit_margin,
                forcedCol: detail.application_rate
            };
            const result = calculateIncentive(calcData, undefined, thresholds);

            const row: any = {
                'No.': index + 1,
                '이름': detail.employee_name,
                '직급': detail.position,
                '부서': detail.store_name || '-',
                '카테고리': detail.category || '택시',
                '적용률': detail.display_col || result.col,
                '매익율(%)': detail.profit_margin,
                '순매출': detail.net_sales,
                '추가매출': detail.additional_sales || 0,
                '매출 인센티브': detail.incentive_amount,
            };

            additionalIncentiveTypes?.forEach(type => {
                row[type.name] = detail.extra_incentives?.[type.name] || 0;
            });

            const totalExtra = Object.values(detail.extra_incentives || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
            row['최종 인센티브'] = detail.incentive_amount + totalExtra;
            row['달성 단계'] = result.level > 0 ? `${result.level}단계` : '미달성';

            for (let i = 1; i <= 3; i++) {
                const breakdownStep = result.breakdown.find(b => b.level === i);
                if (breakdownStep) {
                    row[`${i}단계 적용매출`] = breakdownStep.salesAmount;
                    row[`${i}단계 요율(%)`] = (breakdownStep.rate * 100).toFixed(1);
                    row[`${i}단계 인센티브 금액`] = breakdownStep.incentiveAmount;
                } else {
                    row[`${i}단계 적용매출`] = '-';
                    row[`${i}단계 요율(%)`] = '-';
                    row[`${i}단계 인센티브 금액`] = '-';
                }
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            { wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 },
            { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
            ...(additionalIncentiveTypes?.map(() => ({ wch: 12 })) || []),
            { wch: 15 }, { wch: 10 },
            { wch: 15 }, { wch: 12 }, { wch: 15 },
            { wch: 15 }, { wch: 12 }, { wch: 15 },
            { wch: 15 }, { wch: 12 }, { wch: 15 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${record.year}년 ${record.month}월`);
        XLSX.writeFile(wb, `인센티브_정산내역_${record.year}년_${record.month}월.xlsx`);
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
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            lang="ko"
                                            style={{ imeMode: 'active' } as any}
                                            placeholder="이름 검색"
                                            value={filters.name}
                                            onChange={e => setFilters(prev => ({ ...prev, name: e.target.value }))}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                                        />
                                        <input
                                            type="text"
                                            lang="ko"
                                            style={{ imeMode: 'active' } as any}
                                            placeholder="부서 검색"
                                            value={filters.store}
                                            onChange={e => setFilters(prev => ({ ...prev, store: e.target.value }))}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32"
                                        />
                                        <select
                                            value={filters.position}
                                            onChange={e => setFilters(prev => ({ ...prev, position: e.target.value }))}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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

                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        if (details) setEditedDetails(details);
                                                    }}
                                                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
                                                >
                                                    <X size={16} /> 취소
                                                </button>
                                                <button
                                                    onClick={() => updateMutation.mutate()}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm shadow-sm"
                                                >
                                                    <Save size={16} /> 저장
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleExportExcel(record)}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm shadow-sm"
                                                >
                                                    <Download size={16} /> 엑셀 다운로드
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(true)}
                                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm shadow-sm"
                                                >
                                                    <Edit2 size={16} /> 수정
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="w-8 px-3 py-3"></th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('employee_name')}>
                                                    <div className="flex items-center">이름 <SortIcon column="employee_name" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('position')}>
                                                    <div className="flex items-center">직급 <SortIcon column="position" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('store_name')}>
                                                    <div className="flex items-center">부서 <SortIcon column="store_name" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('category')}>
                                                    <div className="flex items-center">카테고리 <SortIcon column="category" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('application_rate')}>
                                                    <div className="flex items-center">적용률 <SortIcon column="application_rate" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">매익율</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('net_sales')}>
                                                    <div className="flex items-center justify-end">순매출 <SortIcon column="net_sales" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('additional_sales')}>
                                                    <div className="flex items-center justify-end">추가매출 <SortIcon column="additional_sales" /></div>
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('incentive_amount')}>
                                                    <div className="flex items-center justify-end">매출 인센티브 <SortIcon column="incentive_amount" /></div>
                                                </th>
                                                {additionalIncentiveTypes?.map(type => (
                                                    <th key={type.id} className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                                                        {type.name}
                                                    </th>
                                                ))}
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">최종 인센티브</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">단계</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {processedDetails.map((detail, idx) => {
                                                const isExpanded = expandedDetailIndex === idx;

                                                // Calculate breakdown on the fly for display
                                                let breakdown = null;
                                                if (isExpanded) {
                                                    const thresholds = settings?.thresholds || DEFAULT_THRESHOLDS;
                                                    const calcData = {
                                                        name: detail.employee_name,
                                                        position: detail.position,
                                                        category: detail.category || '택시',
                                                        netSales: detail.net_sales,
                                                        additionalSales: detail.additional_sales,
                                                        profitMargin: detail.profit_margin,
                                                        forcedCol: detail.application_rate
                                                    };
                                                    const result = calculateIncentive(calcData, undefined, thresholds);
                                                    breakdown = result.breakdown;
                                                }

                                                return (
                                                    <>
                                                        <tr
                                                            key={detail.id || idx}
                                                            className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                                                            onClick={() => toggleDetailExpand(idx)}
                                                        >
                                                            <td className="px-3 py-3 text-center">
                                                                {isExpanded ? <ArrowUp size={16} className="text-gray-400" /> : <ArrowDown size={16} className="text-gray-400" />}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm font-medium text-gray-900" onClick={e => e.stopPropagation()}>{detail.employee_name}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                                {isEditing ? (
                                                                    <select
                                                                        value={detail.position}
                                                                        onChange={(e) => handleInputChange(detail.id, 'position', e.target.value)}
                                                                        className="w-24 p-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        <option value="공장장">공장장</option>
                                                                        <option value="팀장">팀장</option>
                                                                        <option value="선임기사">선임기사</option>
                                                                        <option value="기사">기사</option>
                                                                        <option value="수습">수습</option>
                                                                        <option value="기타">기타</option>
                                                                    </select>
                                                                ) : detail.position}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">{detail.store_name || '-'}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                                {isEditing ? (
                                                                    <select
                                                                        value={detail.category || '택시'}
                                                                        onChange={(e) => handleInputChange(detail.id, 'category', e.target.value)}
                                                                        className="w-24 p-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        <option value="택시">택시</option>
                                                                        <option value="빵빵">빵빵</option>
                                                                    </select>
                                                                ) : (detail.category || '택시')}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                                {isEditing ? (
                                                                    <select
                                                                        value={detail.application_rate || ''}
                                                                        onChange={(e) => handleInputChange(detail.id, 'application_rate', e.target.value)}
                                                                        className="w-16 p-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        <option value="">{detail.display_col} (Auto)</option>
                                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                                                                            const isTaxi = (detail.category || '택시').includes('택시');
                                                                            if (isTaxi && num > 5) return null;
                                                                            return <option key={num} value={num}>{num}</option>;
                                                                        })}
                                                                    </select>
                                                                ) : (detail.display_col || '-')}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                                                                {detail.profit_margin}%
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right text-gray-900" onClick={e => e.stopPropagation()}>
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={detail.net_sales}
                                                                        onChange={(e) => handleInputChange(detail.id, 'net_sales', e.target.value)}
                                                                        className="w-24 p-1 border rounded text-right focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    />
                                                                ) : detail.net_sales.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right text-gray-900" onClick={e => e.stopPropagation()}>
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={detail.additional_sales || 0}
                                                                        onChange={(e) => handleInputChange(detail.id, 'additional_sales', e.target.value)}
                                                                        className="w-24 p-1 border rounded text-right focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    />
                                                                ) : (detail.additional_sales || 0).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{detail.incentive_amount.toLocaleString()}</td>

                                                            {/* Extra Incentives Columns */}
                                                            {additionalIncentiveTypes?.map(type => {
                                                                const amount = detail.extra_incentives?.[type.name] || 0;
                                                                return (
                                                                    <td key={type.id} className="px-4 py-3 text-sm text-right text-blue-600">
                                                                        {isEditing ? (
                                                                            <input
                                                                                type="number"
                                                                                value={amount === 0 ? '' : amount}
                                                                                onChange={(e) => handleExtraIncentiveChange(detail.id, type.name, e.target.value)}
                                                                                className="w-20 p-1 border rounded text-right focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50"
                                                                                placeholder="0"
                                                                            />
                                                                        ) : (
                                                                            amount > 0 ? amount.toLocaleString() : '-'
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}

                                                            {/* Total Incentive Column */}
                                                            <td className="px-4 py-3 text-sm text-right font-bold text-blue-700 bg-blue-50/30">
                                                                {(detail.incentive_amount + Object.values(detail.extra_incentives || {}).reduce((sum, val) => sum + (Number(val) || 0), 0)).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-center">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${detail.level > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                    {detail.level > 0 ? `${detail.level}단계` : '미달성'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && breakdown && breakdown.length > 0 && (
                                                            <tr className="bg-blue-50/50">
                                                                <td colSpan={11} className="px-6 py-4">
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
                                                                        {breakdown.map((item, i) => (
                                                                            <div key={i} className="grid grid-cols-12 gap-4 text-sm text-gray-700 py-1.5 border-b border-gray-50 last:border-0">
                                                                                <div className="col-span-1 font-medium text-blue-600">{item.level}단계</div>
                                                                                <div className="col-span-3 text-gray-500">
                                                                                    {item.min.toLocaleString()} ~ {item.max ? item.max.toLocaleString() : '∞'}
                                                                                </div>
                                                                                <div className="col-span-2 text-right font-mono">{item.salesAmount.toLocaleString()}</div>
                                                                                <div className="col-span-2 text-right text-gray-500">{(item.rate * 100).toFixed(1)}%</div>
                                                                                <div className="col-span-2 text-right text-gray-500">{(detail.multiplier * 100).toFixed(0)}%</div>
                                                                                <div className="col-span-2 text-right font-bold text-blue-600">{item.incentiveAmount.toLocaleString()}</div>
                                                                            </div>
                                                                        ))}
                                                                        <div className="grid grid-cols-12 gap-4 text-sm font-bold text-gray-900 pt-3 mt-2 border-t border-gray-200">
                                                                            <div className="col-span-10 text-right">합계</div>
                                                                            <div className="col-span-2 text-right text-blue-700">
                                                                                {breakdown.reduce((sum, item) => sum + item.incentiveAmount, 0).toLocaleString()}
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
                        )}
                    </div>
                ))}

                {records?.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500">저장된 기록이 없습니다.</p>
                    </div>
                )}
            </div>
        </div >
    );
}
