'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi, AdminTenant, PaginatedResponse } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';

const planColors: Record<string, string> = {
  FREE: 'bg-gray-500',
  STARTER: 'bg-blue-500',
  PRO: 'bg-purple-500',
  ENTERPRISE: 'bg-orange-500',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  SUSPENDED: 'bg-yellow-500',
  DELETED: 'bg-red-500',
};

export default function AdminTenantsPage() {
  const [data, setData] = useState<PaginatedResponse<AdminTenant> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Edit modal state
  const [editingTenant, setEditingTenant] = useState<AdminTenant | null>(null);
  const [editForm, setEditForm] = useState({ name: '', plan: '', status: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deletingTenant, setDeletingTenant] = useState<AdminTenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: result } = await adminApi.getTenants({ page, search: search || undefined });
      setData(result);
      setError(null);
    } catch (err) {
      setError('Failed to load tenants');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

  const openEditModal = (tenant: AdminTenant) => {
    setEditingTenant(tenant);
    setEditForm({
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
    });
  };

  const handleEdit = async () => {
    if (!editingTenant) return;

    setIsSaving(true);
    try {
      await adminApi.updateTenant(editingTenant.id, {
        name: editForm.name,
        plan: editForm.plan as AdminTenant['plan'],
        status: editForm.status as AdminTenant['status'],
      });
      setEditingTenant(null);
      fetchTenants();
    } catch (err) {
      console.error(err);
      alert('Failed to update tenant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;

    setIsDeleting(true);
    try {
      await adminApi.deleteTenant(deletingTenant.id);
      setDeletingTenant(null);
      fetchTenants();
    } catch (err) {
      console.error(err);
      alert('Failed to delete tenant');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Tenants</h1>
        <p className="text-gray-400 mt-1">Manage all tenants in the platform</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <Input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-gray-800 border-gray-700 text-white"
        />
        <Button type="submit" className="bg-red-600 hover:bg-red-700">
          Search
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-red-900/50 border border-red-700">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      )}

      {/* Table */}
      {!isLoading && data && (
        <>
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Slug
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.data.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {tenant.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={planColors[tenant.plan]}>{tenant.plan}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={statusColors[tenant.status]}>{tenant.status}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {tenant._count.members}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openEditModal(tenant)}
                        className="text-blue-400 hover:text-blue-300 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingTenant(tenant)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                  disabled={page === data.meta.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingTenant}
        onClose={() => setEditingTenant(null)}
        title="Edit Tenant"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Select
            label="Plan"
            value={editForm.plan}
            onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
            options={[
              { value: 'FREE', label: 'Free' },
              { value: 'STARTER', label: 'Starter' },
              { value: 'PRO', label: 'Pro' },
              { value: 'ENTERPRISE', label: 'Enterprise' },
            ]}
          />
          <Select
            label="Status"
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'DELETED', label: 'Deleted' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditingTenant(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} isLoading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={!!deletingTenant}
        onClose={() => setDeletingTenant(null)}
        title="Delete Tenant"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete the tenant &quot;{deletingTenant?.name}&quot;?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setDeletingTenant(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
