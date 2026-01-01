import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Save, X } from 'lucide-react';

interface SalaryComponent {
    id: number;
    name: string;
    type: 'allowance' | 'deduction';
    is_taxable: boolean;
    is_fixed: boolean;
    default_amount: number;
}

export function SalaryComponentsPage() {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form States
    const [newComponent, setNewComponent] = useState<Partial<SalaryComponent>>({
        name: '',
        type: 'allowance',
        is_taxable: true,
        is_fixed: true,
        default_amount: 0
    });
    const [editForm, setEditForm] = useState<Partial<SalaryComponent>>({});

    // Fetch Components
    const { data: components, isLoading } = useQuery({
        queryKey: ['salary_components'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('salary_components')
                .select('*')
                .order('type')
                .order('id');
            if (error) throw error;
            return data as SalaryComponent[];
        }
    });

    // Mutations
    const addMutation = useMutation({
        mutationFn: async (component: Partial<SalaryComponent>) => {
            const { error } = await supabase.from('salary_components').insert([component]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary_components'] });
            setIsAdding(false);
            setNewComponent({
                name: '',
                type: 'allowance',
                is_taxable: true,
                is_fixed: true,
                default_amount: 0
            });
        },
        onError: (error: any) => alert(error.message)
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: number; updates: Partial<SalaryComponent> }) => {
            const { error } = await supabase.from('salary_components').update(updates).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary_components'] });
            setEditingId(null);
        },
        onError: (error: any) => alert(error.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('salary_components').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salary_components'] }),
        onError: (error: any) => alert(error.message)
    });

    const handleAdd = () => {
        if (!newComponent.name) return alert('항목명을 입력해주세요.');
        addMutation.mutate(newComponent);
    };

    const startEditing = (component: SalaryComponent) => {
        setEditingId(component.id);
        setEditForm({ ...component });
    };

    const saveEditing = () => {
        if (!editingId) return;
        updateMutation.mutate({ id: editingId, updates: editForm });
    };

    const handleDelete = (id: number) => {
        if (confirm('정말 삭제하시겠습니까? 이미 급여 설정에 사용 중인 항목일 수 있습니다.')) {
            deleteMutation.mutate(id);
        }
    };

    if (isLoading) return <div className="p-8">로딩 중...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">수당 및 공제 관리</h2>
                <button
                    onClick={() => setIsAdding(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                    <Plus size={18} className="mr-2" /> 항목 추가
                </button>
            </div>

            {isAdding && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 animate-fade-in">
                    <h3 className="font-bold text-blue-800 mb-3">새 항목 추가</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">구분</label>
                            <select
                                value={newComponent.type}
                                onChange={e => setNewComponent({ ...newComponent, type: e.target.value as any })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="allowance">수당 (지급)</option>
                                <option value="deduction">공제 (차감)</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">항목명</label>
                            <input
                                type="text"
                                value={newComponent.name}
                                onChange={e => setNewComponent({ ...newComponent, name: e.target.value })}
                                className="w-full p-2 border rounded"
                                placeholder="예: 야간수당"
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">기본 금액</label>
                            <input
                                type="number"
                                value={newComponent.default_amount}
                                onChange={e => setNewComponent({ ...newComponent, default_amount: Number(e.target.value) })}
                                className="w-full p-2 border rounded"
                            />
                        </div>
                        <div className="md:col-span-1 flex space-x-4 py-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newComponent.is_taxable}
                                    onChange={e => setNewComponent({ ...newComponent, is_taxable: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                <span className="text-sm">과세</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newComponent.is_fixed}
                                    onChange={e => setNewComponent({ ...newComponent, is_fixed: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                <span className="text-sm">고정급</span>
                            </label>
                        </div>
                        <div className="md:col-span-1 flex space-x-2">
                            <button onClick={handleAdd} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">저장</button>
                            <button onClick={() => setIsAdding(false)} className="flex-1 bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300">취소</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">구분</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">항목명</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">기본 금액</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">속성</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {components?.map((comp) => (
                            <tr key={comp.id} className="hover:bg-gray-50">
                                {editingId === comp.id ? (
                                    <>
                                        <td className="px-6 py-4">
                                            <select
                                                value={editForm.type}
                                                onChange={e => setEditForm({ ...editForm, type: e.target.value as any })}
                                                className="p-1 border rounded text-sm"
                                            >
                                                <option value="allowance">수당</option>
                                                <option value="deduction">공제</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full p-1 border rounded text-sm"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <input
                                                type="number"
                                                value={editForm.default_amount}
                                                onChange={e => setEditForm({ ...editForm, default_amount: Number(e.target.value) })}
                                                className="w-full p-1 border rounded text-sm text-right"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center space-x-3">
                                            <label className="inline-flex items-center space-x-1">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.is_taxable}
                                                    onChange={e => setEditForm({ ...editForm, is_taxable: e.target.checked })}
                                                />
                                                <span className="text-xs">과세</span>
                                            </label>
                                            <label className="inline-flex items-center space-x-1">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.is_fixed}
                                                    onChange={e => setEditForm({ ...editForm, is_fixed: e.target.checked })}
                                                />
                                                <span className="text-xs">고정</span>
                                            </label>
                                        </td>
                                        <td className="px-6 py-4 text-center space-x-2">
                                            <button onClick={saveEditing} className="text-blue-600 hover:text-blue-800"><Save size={18} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-700"><X size={18} /></button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${comp.type === 'allowance' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                {comp.type === 'allowance' ? '수당' : '공제'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{comp.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                            {comp.default_amount.toLocaleString()}원
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                            {comp.is_taxable && <span className="mx-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">과세</span>}
                                            {comp.is_fixed && <span className="mx-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded">고정급</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button onClick={() => startEditing(comp)} className="text-blue-600 hover:text-blue-900 mr-3">수정</button>
                                            <button onClick={() => handleDelete(comp.id)} className="text-red-600 hover:text-red-900">삭제</button>
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
