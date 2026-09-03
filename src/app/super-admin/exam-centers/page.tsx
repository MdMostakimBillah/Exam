"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { getExamCenters, createExamCenter, updateExamCenter } from "@/lib/storage/exam-centers";
import { School, Plus, Pencil } from "lucide-react";

export default function ExamCentersPage() {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', capacity: '' });

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-8 w-48 skeleton rounded" />;

  const centers = getExamCenters();
  const totalCapacity = centers.reduce((s, c) => s + c.capacity, 0);
  const totalAllocated = centers.reduce((s, c) => s + c.allocated, 0);

  const handleSave = () => {
    if (!form.name || !form.capacity) return;
    const data = { name: form.name, address: form.address, capacity: parseInt(form.capacity), allocated: 0 };
    if (editId) { updateExamCenter(editId, data); toast('success', 'Center updated'); }
    else { createExamCenter(data); toast('success', 'Center created'); }
    setModalOpen(false); setEditId(null); setForm({ name: '', address: '', capacity: '' });
  };

  return (
    <div>
      <PageHeader title="Exam Centers" description="Manage examination venues and capacity.">
        <Button onClick={() => { setForm({ name: '', address: '', capacity: '' }); setEditId(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Center
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total Centers" value={centers.length} icon={School} />
        <StatCard title="Total Seats" value={totalCapacity} icon={School} />
        <StatCard title="Allocated" value={totalAllocated} icon={School} />
        <StatCard title="Available" value={totalCapacity - totalAllocated} icon={School} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Center Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Allocated</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {centers.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium text-zinc-200">{c.name}</TableCell>
                <TableCell className="text-xs text-zinc-500">{c.address}</TableCell>
                <TableCell className="text-sm text-zinc-400">{c.capacity}</TableCell>
                <TableCell className="text-sm text-zinc-400">{c.allocated}</TableCell>
                <TableCell className="text-sm text-zinc-400">{c.capacity - c.allocated}</TableCell>
                <TableCell>
                  <div className="w-20">
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-white/[0.2]" style={{ width: `${(c.allocated / c.capacity) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-600">{Math.round((c.allocated / c.capacity) * 100)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditId(c.id); setForm({ name: c.name, address: c.address, capacity: String(c.capacity) }); setModalOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Center' : 'Add Center'}>
        <div className="space-y-3">
          <div><label className="block text-xs text-zinc-500 mb-1">Center Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter center name" /></div>
          <div><label className="block text-xs text-zinc-500 mb-1">Address</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Enter address" /></div>
          <div><label className="block text-xs text-zinc-500 mb-1">Capacity</label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Maximum seats" /></div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>{editId ? 'Update' : 'Create'}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
