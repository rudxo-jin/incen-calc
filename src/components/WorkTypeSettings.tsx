import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Save, X, Clock } from 'lucide-react';

interface WorkType {
    id: number;
    name: string;
    days_per_week: number;
    basic_daily_hours: number;
    overtime_daily_hours: number;
    overtime_days_per_week: number;
    holiday_work_daily_hours: number;
    holiday_work_days_per_week: number;
    description: string;
}

export function WorkTypeSettings() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form States
    const [newWorkType, setNewWorkType] = useState<Partial<WorkType>>({
        name: '',
        days_per_week: 5,
        basic_daily_hours: 8,
        overtime_daily_hours: 0,
        overtime_days_per_week: 0,
        holiday_work_daily_hours: 0,
        holiday_work_days_per_week: 0,
        description: ''
    });
    const [editForm, setEditForm] = useState<Partial<WorkType>>({});

    // Fetch Work Types
    const { data: workTypes, isLoading } = useQuery({
        queryKey: ['work_types'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('work_types')
                .select('*')
                .order('id');
            if (error) throw error;
            return data as WorkType[];
        }
    });

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (workType: Partial<WorkType>) => {
            const { error } = await supabase.from('work_types').insert([workType]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work_types'] });
            setIsAdding(false);
            setNewWorkType({
                name: '',
                days_per_week: 5,
                basic_daily_hours: 8,
                overtime_daily_hours: 0,
                overtime_days_per_week: 0,
                holiday_work_daily_hours: 0,
                holiday_work_days_per_week: 0,
                description: ''
            });
        },
        onError: (error: any) => alert(error.message)
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<WorkType> }) => {
            const { error } = await supabase.from('work_types').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work_types'] });
            setEditingId(null);
        },
        onError: (error: any) => alert(error.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('work_types').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['work_types'] }),
        onError: (error: any) => alert(error.message)
    });

    const handleAdd = () => {
        if (!newWorkType.name) return alert('근무 형태 명칭을 입력해주세요.');
        addMutation.mutate(newWorkType);
    };

    const startEditing = (workType: WorkType) => {
        setEditingId(workType.id);
        setEditForm({ ...workType });
    };

    const saveEditing = () => {
        if (!editingId) return;
        updateMutation.mutate({ id: editingId, updates: editForm });
    };

    const handleDelete = (id: number) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <div className="p-4">로딩 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                    <Clock className="mr-2" size={20} /> 근무 형태 설정
                </h3>
                <button
                    onClick={() => setIsAdding(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center text-sm"
                >
                    <Plus size={16} className="mr-1" /> 추가
                </button>
            </div>

            {isAdding && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 animate-fade-in">
                    <h4 className="font-bold text-blue-800 mb-3 text-sm">새 근무 형태 추가</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">명칭</label>
                            <input
                                type="text"
                                value={newWorkType.name}
                                onChange={e => setNewWorkType({ ...newWorkType, name: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                                placeholder="예: 주 6일 (연장 포함)"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">설명</label>
                            <input
                                type="text"
                                value={newWorkType.description || ''}
                                onChange={e => setNewWorkType({ ...newWorkType, description: e.target.value })}
                                className="w-full p-2 border rounded text-sm"
                                placeholder="간단한 설명"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">주당 근무일수</label>
                            <input
                                type="number"
                                value={newWorkType.days_per_week}
                                onChange={e => setNewWorkType({ ...newWorkType, days_per_week: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">일 기본근로시간</label>
                            <input
                                type="number"
                                value={newWorkType.basic_daily_hours}
                                onChange={e => setNewWorkType({ ...newWorkType, basic_daily_hours: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">일 연장근로시간</label>
                            <input
                                type="number"
                                value={newWorkType.overtime_daily_hours}
                                onChange={e => setNewWorkType({ ...newWorkType, overtime_daily_hours: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">주 연장근로일수</label>
                            <input
                                type="number"
                                value={newWorkType.overtime_days_per_week}
                                onChange={e => setNewWorkType({ ...newWorkType, overtime_days_per_week: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">일 휴일근로시간</label>
                            <input
                                type="number"
                                value={newWorkType.holiday_work_daily_hours}
                                onChange={e => setNewWorkType({ ...newWorkType, holiday_work_daily_hours: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">주 휴일근로일수</label>
                            <input
                                type="number"
                                value={newWorkType.holiday_work_days_per_week}
                                onChange={e => setNewWorkType({ ...newWorkType, holiday_work_days_per_week: Number(e.target.value) })}
                                className="w-full p-2 border rounded text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex space-x-2 justify-end">
                        <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">취소</button>
                        <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">저장</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">명칭</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">급여 산정 시간 상세 (월 기준)</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {workTypes?.map((type) => (
                            <tr key={type.id} className="hover:bg-gray-50">
                                {editingId === type.id ? (
                                    <>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full p-1 border rounded text-xs mb-1"
                                            />
                                            <input
                                                type="text"
                                                value={editForm.description || ''}
                                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                                className="w-full p-1 border rounded text-xs text-gray-500"
                                                placeholder="설명"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center" colSpan={1}>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <div className="font-medium mb-1">기본</div>
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <input
                                                            type="number"
                                                            value={editForm.basic_daily_hours}
                                                            onChange={e => setEditForm({ ...editForm, basic_daily_hours: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>h</span>
                                                        <span>/</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.days_per_week}
                                                            onChange={e => setEditForm({ ...editForm, days_per_week: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>일</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <div className="font-medium mb-1">연장</div>
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <input
                                                            type="number"
                                                            value={editForm.overtime_daily_hours}
                                                            onChange={e => setEditForm({ ...editForm, overtime_daily_hours: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>h</span>
                                                        <span>/</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.overtime_days_per_week}
                                                            onChange={e => setEditForm({ ...editForm, overtime_days_per_week: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>일</span>
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <div className="font-medium mb-1">휴일</div>
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <input
                                                            type="number"
                                                            value={editForm.holiday_work_daily_hours}
                                                            onChange={e => setEditForm({ ...editForm, holiday_work_daily_hours: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>h</span>
                                                        <span>/</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.holiday_work_days_per_week}
                                                            onChange={e => setEditForm({ ...editForm, holiday_work_days_per_week: Number(e.target.value) })}
                                                            className="w-10 p-1 border rounded text-center"
                                                        />
                                                        <span>일</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center space-x-2">
                                            <button onClick={saveEditing} className="text-blue-600 hover:text-blue-800"><Save size={16} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700"><X size={16} /></button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900">{type.name}</div>
                                            <div className="text-xs text-gray-500">{type.description}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-600" colSpan={1}>
                                            <div className="space-y-2 text-left bg-gray-50 p-3 rounded-lg">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">기본시간 :</span>
                                                    <span className="font-mono">
                                                        {type.basic_daily_hours}시간 * {type.days_per_week}일 * 4.345주 = {Math.round(type.basic_daily_hours * type.days_per_week * 4.345 * 10) / 10}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">연장근로시간 :</span>
                                                    <span className="font-mono">
                                                        {type.overtime_daily_hours}시간 * 150% * {type.overtime_days_per_week}일 * 4.345주 = {Math.round(type.overtime_daily_hours * 1.5 * type.overtime_days_per_week * 4.345 * 10) / 10}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">휴일근로시간 :</span>
                                                    <span className="font-mono">
                                                        {type.holiday_work_daily_hours}시간 * 150% * {type.holiday_work_days_per_week}일 * 4.345주 = {Math.round(type.holiday_work_daily_hours * 1.5 * type.holiday_work_days_per_week * 4.345 * 10) / 10}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">주휴수당(시간) :</span>
                                                    <span className="font-mono">
                                                        {type.days_per_week >= 5 ? 8 : 0}시간 * 4.345주 = {Math.round((type.days_per_week >= 5 ? 8 : 0) * 4.345 * 10) / 10}
                                                    </span>
                                                </div>
                                                <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold text-sm text-blue-600">
                                                    <span>월 합계 :</span>
                                                    <span>
                                                        {Math.round(
                                                            (
                                                                (type.basic_daily_hours * type.days_per_week * 4.345) +
                                                                (type.overtime_daily_hours * 1.5 * type.overtime_days_per_week * 4.345) +
                                                                (type.holiday_work_daily_hours * 1.5 * type.holiday_work_days_per_week * 4.345) +
                                                                ((type.days_per_week >= 5 ? 8 : 0) * 4.345)
                                                            ) * 100
                                                        ) / 100} 시간
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => startEditing(type)} className="text-blue-600 hover:text-blue-900 mr-2">수정</button>
                                            <button onClick={() => handleDelete(type.id)} className="text-red-600 hover:text-red-900">삭제</button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
