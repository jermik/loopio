import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Shield, Users, Key, Loader2, BarChart3, Copy, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface LicenseKey {
  id: string;
  email: string;
  license_key: string;
  is_active: boolean;
  created_at: string;
  stripe_session_id: string | null;
}

interface Profile {
  id: string;
  email: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user";
}

export default function Admin() {
  const [licenseKeys, setLicenseKeys] = useState<LicenseKey[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [downloadStats, setDownloadStats] = useState<Record<string, number>>({});
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [genEmail, setGenEmail] = useState("");
  const [genCount, setGenCount] = useState("1");
  const [genLoading, setGenLoading] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const navigate = useNavigate();

  const fetchData = async () => {
    const [licRes, profRes, rolesRes, dlRes] = await Promise.all([
      supabase.from("license_keys").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("download_events").select("platform"),
    ]);

    if (licRes.error && profRes.error) {
      toast.error("Access denied. Admin role required.");
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    setLicenseKeys(licRes.data || []);
    setProfiles(profRes.data || []);
    setUserRoles(rolesRes.data || []);

    const events = dlRes.data || [];
    const stats: Record<string, number> = {};
    events.forEach((e) => { stats[e.platform] = (stats[e.platform] || 0) + 1; });
    setDownloadStats(stats);
    setTotalDownloads(events.length);

    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      fetchData();
    };

    supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
    });

    init();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleGenerateKeys = async () => {
    setGenLoading(true);
    setGeneratedKeys([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-license", {
        body: { email: genEmail || undefined, count: parseInt(genCount) || 1 },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedKeys(data.keys || []);
      toast.success(`Generated ${data.keys?.length || 0} license key(s)`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate keys");
    } finally {
      setGenLoading(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard!");
  };

  const getUserRole = (userId: string): string => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || "none";
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleLoading(userId);
    try {
      const existing = userRoles.find((r) => r.user_id === userId);

      if (newRole === "none") {
        if (existing) {
          const { error } = await supabase.from("user_roles").delete().eq("id", existing.id);
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as UserRole["role"] })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole as UserRole["role"] });
        if (error) throw error;
      }

      toast.success("Role updated");
      // Refresh roles
      const { data } = await supabase.from("user_roles").select("*");
      if (data) setUserRoles(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setRoleLoading(null);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setRoleLoading(roleId);
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
      toast.success("Role removed");
      const { data } = await supabase.from("user_roles").select("*");
      if (data) setUserRoles(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove role");
    } finally {
      setRoleLoading(null);
    }
  };

  const handleToggleLicense = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("license_keys")
        .update({ is_active: !currentActive })
        .eq("id", id);
      if (error) throw error;
      setLicenseKeys((prev) =>
        prev.map((lk) => (lk.id === id ? { ...lk, is_active: !currentActive } : lk))
      );
      toast.success(`License ${!currentActive ? "activated" : "deactivated"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update license");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white gap-4">
        <p className="text-lg">You don't have admin access.</p>
        <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>

        <Tabs defaultValue="licenses" className="w-full">
          <TabsList className="bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="licenses" className="gap-2 data-[state=active]:bg-white/10">
              <Key className="w-4 h-4" /> License Keys ({licenseKeys.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-white/10">
              <Users className="w-4 h-4" /> Users ({profiles.length})
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-white/10">
              <Shield className="w-4 h-4" /> Roles ({userRoles.length})
            </TabsTrigger>
            <TabsTrigger value="downloads" className="gap-2 data-[state=active]:bg-white/10">
              <BarChart3 className="w-4 h-4" /> Downloads ({totalDownloads})
            </TabsTrigger>
          </TabsList>

          {/* License Keys Tab */}
          <TabsContent value="licenses">
            {/* Generate Keys */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 mb-6">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Generate Free License Keys
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Email (optional)</label>
                  <Input
                    value={genEmail}
                    onChange={(e) => setGenEmail(e.target.value)}
                    placeholder="giveaway@loopio.app"
                    className="w-56 bg-white/5 border-white/10 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Count</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={genCount}
                    onChange={(e) => setGenCount(e.target.value)}
                    className="w-20 bg-white/5 border-white/10 text-white text-sm"
                  />
                </div>
                <Button onClick={handleGenerateKeys} disabled={genLoading} size="sm" className="gap-2">
                  {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Generate
                </Button>
              </div>
              {generatedKeys.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-white/50">Generated keys (click to copy):</p>
                  {generatedKeys.map((key, i) => (
                    <button
                      key={i}
                      onClick={() => copyKey(key)}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10 transition-colors font-mono text-sm text-green-400 border-none cursor-pointer"
                    >
                      <Copy className="w-3 h-3 shrink-0" />
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">License Key</th>
                    <th className="text-left p-3">Active</th>
                    <th className="text-left p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {licenseKeys.map((lk) => (
                    <tr key={lk.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-3">{lk.email}</td>
                      <td className="p-3 font-mono text-xs">{lk.license_key}</td>
                      <td className="p-3">
                        <Switch
                          checked={lk.is_active}
                          onCheckedChange={() => handleToggleLicense(lk.id, lk.is_active)}
                        />
                      </td>
                      <td className="p-3">{new Date(lk.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {licenseKeys.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-white/40">No license keys yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Joined</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3 w-48">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const currentRole = getUserRole(p.id);
                    return (
                      <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="p-3">{p.email || "—"}</td>
                        <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            currentRole === "admin" ? "bg-red-500/20 text-red-400" :
                            currentRole === "moderator" ? "bg-yellow-500/20 text-yellow-400" :
                            currentRole === "user" ? "bg-blue-500/20 text-blue-400" :
                            "bg-white/10 text-white/40"
                          }`}>
                            {currentRole === "none" ? "No role" : currentRole}
                          </span>
                        </td>
                        <td className="p-3">
                          <Select
                            value={currentRole}
                            onValueChange={(val) => handleRoleChange(p.id, val)}
                            disabled={roleLoading === p.id}
                          >
                            <SelectTrigger className="h-8 w-36 bg-white/5 border-white/10 text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No role</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                  {profiles.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-white/40">No users yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles">
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Role</th>
                    <th className="text-left p-3 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userRoles.map((r) => {
                    const profile = profiles.find((p) => p.id === r.user_id);
                    return (
                      <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="p-3">{profile?.email || r.user_id}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            r.role === "admin" ? "bg-red-500/20 text-red-400" :
                            r.role === "moderator" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {r.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleDeleteRole(r.id)}
                            disabled={roleLoading === r.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {userRoles.length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-white/40">No roles assigned yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Downloads Tab */}
          <TabsContent value="downloads">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {["windows", "mac", "linux"].map((platform) => (
                <div key={platform} className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                  <p className="text-sm text-white/50 uppercase tracking-wider mb-2">{platform}</p>
                  <p className="text-3xl font-bold">{downloadStats[platform] || 0}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm text-white/50 uppercase tracking-wider mb-2">Total Downloads</p>
              <p className="text-4xl font-bold">{totalDownloads}</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
