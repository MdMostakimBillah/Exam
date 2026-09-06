"use client";
import { useState, useEffect, useRef } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/storage/users";
import { getInstitutions } from "@/lib/storage/institutions";
import { User } from "@/lib/types";
import { formatDate } from "@/lib/storage/storage";
import { useTheme } from "@/contexts/theme-context";
import { useLang } from "@/contexts/language-context";
import { MoreVertical, Edit, Trash2, Search, Plus, Users, Shield, Building2 } from "lucide-react";

export default function UsersPage() {
  const { theme } = useTheme();
  const { lang: language } = useLang();
  const isDark = theme === "dark";
  const isBn = language === "bn";
  const { toast } = useToast();

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "INSTITUTION_ADMIN" as User["role"],
    institutionId: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "INSTITUTION_ADMIN" as User["role"],
    institutionId: "",
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) return <UsersSkeleton isDark={isDark} />;

  const users = getUsers();
  const institutions = getInstitutions();

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalCount = users.length;
  const superAdminCount = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const instAdminCount = users.filter((u) => u.role === "INSTITUTION_ADMIN").length;

  const getInstitutionName = (id?: string) => {
    if (!id) return "—";
    return institutions.find((i) => i.id === id)?.name || "—";
  };

  const handleAdd = () => {
    setAddForm({ name: "", email: "", password: "", role: "INSTITUTION_ADMIN", institutionId: "" });
    setShowAddModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId || "",
    });
    setShowEditModal(true);
    setMenuOpenId(null);
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
    setMenuOpenId(null);
  };

  const handleSaveAdd = () => {
    if (!addForm.name || !addForm.email || !addForm.password) {
      toast("error", isBn ? "নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক" : "Name, email and password are required");
      return;
    }
    const existing = users.find((u) => u.email === addForm.email);
    if (existing) {
      toast("error", isBn ? "এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে" : "This email is already in use");
      return;
    }
    createUser({
      name: addForm.name,
      email: addForm.email,
      password: addForm.password,
      role: addForm.role,
      institutionId: addForm.role === "INSTITUTION_ADMIN" ? addForm.institutionId : undefined,
    });
    toast("success", isBn ? "ব্যবহারকারী তৈরি হয়েছে" : "User created");
    setShowAddModal(false);
    setRefreshKey((k) => k + 1);
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;
    if (!editForm.name || !editForm.email) {
      toast("error", isBn ? "নাম এবং ইমেইল আবশ্যক" : "Name and email are required");
      return;
    }
    const duplicate = users.find((u) => u.email === editForm.email && u.id !== editingUser.id);
    if (duplicate) {
      toast("error", isBn ? "এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে" : "This email is already in use");
      return;
    }
    updateUser(editingUser.id, {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      institutionId: editForm.role === "INSTITUTION_ADMIN" ? editForm.institutionId : undefined,
    });
    toast("success", isBn ? "ব্যবহারকারী আপডেট হয়েছে" : "User updated");
    setShowEditModal(false);
    setEditingUser(null);
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    deleteUser(deletingUser.id);
    toast("success", isBn ? "ব্যবহারকারী মুছে ফেলা হয়েছে" : "User deleted");
    setShowDeleteModal(false);
    setDeletingUser(null);
    setRefreshKey((k) => k + 1);
  };

  const card = isDark
    ? "bg-[#141416] border border-white/[0.06] rounded-2xl"
    : "bg-white border border-zinc-200 rounded-2xl shadow-sm";
  const iconBg = isDark ? "bg-white/[0.08]" : "bg-zinc-100";
  const iconColor = isDark ? "text-zinc-300" : "text-zinc-600";
  const inputCls = isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-zinc-50 border-zinc-200";
  const labelCls = isDark ? "text-zinc-500" : "text-zinc-500";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}>
              {isBn ? "ব্যবহারকারী" : "Users"}
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
              {isBn ? "সিস্টেম ব্যবহারকারী পরিচালনা করুন" : "Manage system users and roles"}
            </p>
          </div>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> {isBn ? "ব্যবহারকারী যোগ" : "Add User"}
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[
            { icon: Users, label: isBn ? "মোট ব্যবহারকারী" : "Total Users", value: totalCount },
            { icon: Shield, label: isBn ? "সুপার অ্যাডমিন" : "Super Admins", value: superAdminCount },
            { icon: Building2, label: isBn ? "প্রতিষ্ঠান অ্যাডমিন" : "Institution Admins", value: instAdminCount },
          ].map((s) => (
            <div key={s.label} className={`${card} px-4 py-3 flex items-center gap-3`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                <s.icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-lg font-bold tracking-tight leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{s.value}</p>
                <p className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className={`${card} p-4 mb-6`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
              <Input
                placeholder={isBn ? "নাম বা ইমেইল দিয়ে অনুসন্ধান..." : "Search by name or email..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-10 ${inputCls}`}
              />
            </div>
            <Select
              options={[
                { label: isBn ? "সব ভূমিকা" : "All Roles", value: "" },
                { label: isBn ? "সুপার অ্যাডমিন" : "Super Admin", value: "SUPER_ADMIN" },
                { label: isBn ? "প্রতিষ্ঠান অ্যাডমিন" : "Institution Admin", value: "INSTITUTION_ADMIN" },
              ]}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`w-full sm:w-44 ${inputCls}`}
            />
          </div>
        </div>

        {/* Table */}
        <div className={`${card}`}>
          <div className={`px-5 py-4 border-b ${isDark ? "border-white/[0.06]" : "border-zinc-100"}`}>
            <div className="flex items-center gap-2">
              <Users className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "ব্যবহারকারী তালিকা" : "Users"}
              </h3>
              <span className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>({filtered.length})</span>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-white/[0.08]" : "bg-zinc-100"}`}>
                <Users className={`h-7 w-7 ${iconColor}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? "text-white" : "text-zinc-900"}`}>
                {isBn ? "কোনো ব্যবহারকারী পাওয়া যায়নি" : "No users found"}
              </p>
              <p className={`text-xs mt-1 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                {isBn ? "অনুসন্ধান বা ফিল্টার পরিবর্তন করুন" : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={isDark ? "border-white/[0.04] hover:bg-transparent" : "border-zinc-100 hover:bg-transparent"}>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "ব্যবহারকারী" : "User"}
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "ভূমিকা" : "Role"}
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden md:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "প্রতিষ্ঠান" : "Institution"}
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider hidden lg:table-cell ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "তৈরি" : "Created"}
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    {isBn ? "স্ট্যাটাস" : "Status"}
                  </TableHead>
                  <TableHead className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? "text-zinc-400" : "text-zinc-500"}`}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className={`${isDark ? "border-white/[0.04] hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50/50"}`}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isDark ? "bg-white/[0.08] text-zinc-300" : "bg-zinc-100 text-zinc-600"}`}>
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>{user.name}</p>
                          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                          user.role === "SUPER_ADMIN"
                            ? isDark
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-amber-50 text-amber-700"
                            : isDark
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {user.role === "SUPER_ADMIN"
                          ? isBn
                            ? "সুপার অ্যাডমিন"
                            : "Super Admin"
                          : isBn
                            ? "প্রতিষ্ঠান অ্যাডমিন"
                            : "Institution Admin"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Building2 className={`h-3 w-3 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                        <span className={`text-[11px] ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                          {getInstitutionName(user.institutionId)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{formatDate(user.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge status="ACTIVE" />
                    </TableCell>
                    <TableCell>
                      <div className="relative" ref={menuOpenId === user.id ? dropdownRef : undefined}>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                            isDark ? "hover:bg-white/[0.08] text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuOpenId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                            <div
                              className={`absolute right-0 top-8 z-50 w-40 rounded-xl border py-1 shadow-lg ${
                                isDark ? "bg-[#1a1a1c] border-white/[0.08]" : "bg-white border-zinc-200"
                              }`}
                            >
                              <button
                                onClick={() => handleEdit(user)}
                                className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${
                                  isDark ? "text-zinc-400 hover:bg-white/[0.05] hover:text-white" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                                }`}
                              >
                                <Edit className="h-3.5 w-3.5" /> {isBn ? "সম্পাদনা" : "Edit"}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(user)}
                                className={`flex items-center gap-2 w-full px-3 py-2 text-[11px] ${
                                  isDark ? "text-red-400 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"
                                }`}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> {isBn ? "মুছুন" : "Delete"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={isBn ? "নতুন ব্যবহারকারী" : "Add User"}
        description={isBn ? "নতুন ব্যবহারকারী যোগ করুন" : "Add a new user to the system"}
      >
        <div className="space-y-4">
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "নাম" : "Name"}</label>
            <Input
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              placeholder={isBn ? "ব্যবহারকারীর নাম" : "User name"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "ইমেইল" : "Email"}</label>
            <Input
              type="email"
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder={isBn ? "ইমেইল ঠিকানা" : "Email address"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "পাসওয়ার্ড" : "Password"}</label>
            <Input
              type="password"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              placeholder={isBn ? "পাসওয়ার্ড" : "Password"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "ভূমিকা" : "Role"}</label>
            <Select
              options={[
                { label: isBn ? "সুপার অ্যাডমিন" : "Super Admin", value: "SUPER_ADMIN" },
                { label: isBn ? "প্রতিষ্ঠান অ্যাডমিন" : "Institution Admin", value: "INSTITUTION_ADMIN" },
              ]}
              value={addForm.role}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as User["role"], institutionId: e.target.value === "SUPER_ADMIN" ? "" : addForm.institutionId })}
              className={inputCls}
            />
          </div>
          {addForm.role === "INSTITUTION_ADMIN" && (
            <div>
              <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "প্রতিষ্ঠান" : "Institution"}</label>
              <Select
                options={[
                  { label: isBn ? "প্রতিষ্ঠান নির্বাচন করুন" : "Select institution", value: "" },
                  ...institutions.map((i) => ({ label: i.name, value: i.id })),
                ]}
                value={addForm.institutionId}
                onChange={(e) => setAddForm({ ...addForm, institutionId: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowAddModal(false)}
            className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={handleSaveAdd}
            className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {isBn ? "তৈরি" : "Create"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingUser(null); }}
        title={isBn ? "ব্যবহারকারী সম্পাদনা" : "Edit User"}
        description={isBn ? "ব্যবহারকারীর তথ্য আপডেট করুন" : "Update user information"}
      >
        <div className="space-y-4">
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "নাম" : "Name"}</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder={isBn ? "ব্যবহারকারীর নাম" : "User name"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "ইমেইল" : "Email"}</label>
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder={isBn ? "ইমেইল ঠিকানা" : "Email address"}
              className={inputCls}
            />
          </div>
          <div>
            <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "ভূমিকা" : "Role"}</label>
            <Select
              options={[
                { label: isBn ? "সুপার অ্যাডমিন" : "Super Admin", value: "SUPER_ADMIN" },
                { label: isBn ? "প্রতিষ্ঠান অ্যাডমিন" : "Institution Admin", value: "INSTITUTION_ADMIN" },
              ]}
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as User["role"], institutionId: e.target.value === "SUPER_ADMIN" ? "" : editForm.institutionId })}
              className={inputCls}
            />
          </div>
          {editForm.role === "INSTITUTION_ADMIN" && (
            <div>
              <label className={`block text-[11px] mb-1.5 ${labelCls}`}>{isBn ? "প্রতিষ্ঠান" : "Institution"}</label>
              <Select
                options={[
                  { label: isBn ? "প্রতিষ্ঠান নির্বাচন করুন" : "Select institution", value: "" },
                  ...institutions.map((i) => ({ label: i.name, value: i.id })),
                ]}
                value={editForm.institutionId}
                onChange={(e) => setEditForm({ ...editForm, institutionId: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>
        <ModalFooter>
          <button
            onClick={() => { setShowEditModal(false); setEditingUser(null); }}
            className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={handleSaveEdit}
            className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {isBn ? "আপডেট" : "Update"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingUser(null); }}
        title={isBn ? "ব্যবহারকারী মুছুন" : "Delete User"}
        description={isBn ? "এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না" : "This action cannot be undone"}
      >
        <div className="flex flex-col items-center text-center py-2">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? "bg-red-500/10" : "bg-red-50"}`}>
            <Trash2 className={`h-7 w-7 ${isDark ? "text-red-400" : "text-red-500"}`} />
          </div>
          <p className={`text-sm ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
            {isBn
              ? `আপনি কি নিশ্চিত "${deletingUser?.name}" মুছে ফেলতে চান?`
              : `Are you sure you want to delete "${deletingUser?.name}"?`}
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => { setShowDeleteModal(false); setDeletingUser(null); }}
            className={`px-4 py-2 rounded-xl text-[11px] font-medium transition-colors ${
              isDark ? "bg-white/[0.06] text-zinc-400 hover:text-white" : "bg-zinc-100 text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={handleConfirmDelete}
            className="px-4 py-2 rounded-xl text-[11px] font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
          >
            {isBn ? "মুছুন" : "Delete"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function UsersSkeleton({ isDark }: { isDark: boolean }) {
  const card = isDark ? "bg-[#141416] border border-white/[0.06]" : "bg-white border border-zinc-200 shadow-sm";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0b]" : "bg-zinc-50"}`}>
      <div className="max-w-[1600px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`${card} rounded-2xl h-[52px]`} />
          ))}
        </div>
        <div className={`${card} rounded-2xl h-12 mb-6`} />
        <div className={`${card} rounded-2xl h-64`} />
      </div>
    </div>
  );
}
