import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Trash2, Plus, UserCog, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EmployeeDetailModal } from '../components/EmployeeDetailModal';

interface Employee {
    id: number;
    name: string;
    position: string;
    store_name: string;
    type: 'incentive' | 'basic';
    base_salary: number;
    incentive_category?: string;
    hire_date: string;
    is_active: boolean;
    resignation_date?: string;
    work_types?: {
        name: string;
    };
    employee_salary_settings?: {
        amount: number;
        salary_components?: {
            type: string;
        };
    }[];
}

export function EmployeesPage() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

    // --- Sort & Filter State ---
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState({
        name: '',
        store: '',
        position: ''
    });



    // Fetch Settings for Store List
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data, error } = await supabase.from('settings').select('*').single();
            if (error) throw error;
            return data;
        }
    });
    const stores: string[] = settings?.stores ? (typeof settings.stores === 'string' ? JSON.parse(settings.stores) : settings.stores) : [];
    const incentiveCategories: string[] = settings?.incentive_categories ? (typeof settings.incentive_categories === 'string' ? JSON.parse(settings.incentive_categories) : settings.incentive_categories) : ['택시', '빵빵', '미적용'];

    // Fetch Employees
    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select(`
                    *,
                    work_types(name),
                    employee_salary_settings(
                        amount,
                        salary_components(type)
                    )
                `)
                .order('is_active', { ascending: false })
                .order('name');

            if (error) throw error;
            return data as Employee[];
        }
    });

    // --- Derived Data ---
    const processedEmployees = useMemo(() => {
        if (!employees) return [];
        let processed = [...employees];

        // 1. Filter
        if (filters.name) {
            processed = processed.filter(e => e.name.includes(filters.name));
        }
        if (filters.store) {
            processed = processed.filter(e => e.store_name?.includes(filters.store));
        }
        if (filters.position) {
            processed = processed.filter(e => e.position.includes(filters.position));
        }

        // 2. Sort
        if (sortConfig) {
            processed.sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof typeof a];
                let bValue: any = b[sortConfig.key as keyof typeof b];

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processed;
    }, [employees, sortConfig, filters]);

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



    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('employees').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<Employee> }) => {
            const { error } = await supabase.from('employees').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        },
        onError: (error: any) => {
            alert(`수정 실패: ${error.message}`);
        }
    });

    const handleUpdateCategory = (id: number, category: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation(); // Prevent row click
        updateMutation.mutate({ id, updates: { incentive_category: category } });
    };

    const handleOpenAddModal = () => {
        setSelectedEmployeeId(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (id: number) => {
        setSelectedEmployeeId(id);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    const calculateTotalSalary = (employee: Employee) => {
        if (!employee.employee_salary_settings) return 0;
        return employee.employee_salary_settings.reduce((sum, setting) => {
            // @ts-ignore - Supabase type inference limitation
            if (setting.salary_components?.type === 'allowance') {
                return sum + (setting.amount || 0);
            }
            return sum;
        }, 0);
    };

    const calculateTenure = (hireDateStr: string) => {
        if (!hireDateStr) return '-';
        const hireDate = new Date(hireDateStr);
        const today = new Date();

        let years = today.getFullYear() - hireDate.getFullYear();
        let months = today.getMonth() - hireDate.getMonth();

        if (months < 0) {
            years--;
            months += 12;
        }

        if (years === 0 && months === 0) return '1개월 미만';
        return `${years > 0 ? `${years}년 ` : ''}${months}개월`;
    };

    if (isLoading) return <div className="p-8 text-center">로딩 중...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">직원 관리</h2>
                <div className="flex gap-2">
                    <div className="flex gap-2 mr-4">
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
                            {settings?.positions ? (
                                Object.entries(settings.positions as Record<string, string[]>).flatMap(([_, posList]) => posList).map(pos => (
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
                        </select>
                    </div>
                    <button
                        onClick={handleOpenAddModal}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium shadow-sm"
                    >
                        <Plus size={20} className="mr-2" /> 직원 추가
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center">이름 <SortIcon column="name" /></div>
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('position')}
                                >
                                    <div className="flex items-center">직급 <SortIcon column="position" /></div>
                                </th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('store_name')}
                                >
                                    <div className="flex items-center">부서 <SortIcon column="store_name" /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">인센티브 구분</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">급여 정보</th>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('hire_date')}
                                >
                                    <div className="flex items-center">근무연수 <SortIcon column="hire_date" /></div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">상태</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">관리</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">


                            {/* Employee List */}
                            {processedEmployees.map((employee) => {
                                const totalSalary = calculateTotalSalary(employee);
                                return (
                                    <tr
                                        key={employee.id}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => handleOpenEditModal(employee.id)}
                                    >
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{employee.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{employee.position}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{employee.store_name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            <select
                                                value={employee.incentive_category || '미적용'}
                                                onChange={(e) => handleUpdateCategory(employee.id, e.target.value, e)}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`px-2 py-0.5 rounded text-xs border-none outline-none cursor-pointer ${employee.incentive_category === '택시' ? 'bg-yellow-100 text-yellow-800' :
                                                    employee.incentive_category === '빵빵' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {incentiveCategories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                            {employee.work_types ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-xs">{employee.work_types.name}</span>
                                                    <span className="text-gray-500 text-xs">
                                                        {totalSalary > 0 ? `${totalSalary.toLocaleString()}원` : '-'}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-blue-600 font-medium">{calculateTenure(employee.hire_date)}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${employee.resignation_date ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                }`}>
                                                {employee.resignation_date ? '퇴사' : '재직'}
                                            </span>
                                            {employee.resignation_date && (
                                                <div className="text-xs text-gray-400 mt-1">{employee.resignation_date}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium flex items-center justify-center mx-auto"
                                            >
                                                <UserCog size={16} className="mr-1" /> 관리
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={(e) => handleDelete(employee.id, e)} className="text-gray-400 hover:text-red-600">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {employees?.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        등록된 직원이 없습니다. 우측 상단의 '직원 추가' 버튼을 통해 추가해주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <datalist id="store-list">
                {stores?.map((store) => (
                    <option key={store} value={store} />
                ))}
            </datalist>

            {
                isModalOpen && (
                    <EmployeeDetailModal
                        employeeId={selectedEmployeeId}
                        onClose={() => setIsModalOpen(false)}
                    />
                )
            }
        </div >
    );
}
