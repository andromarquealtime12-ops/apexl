 import { useState } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
 import { Gift, Copy, Users, DollarSign, Share2, CheckCircle } from "lucide-react";
 import { useMyReferralCode, useReferralStats, useMyReferrals } from "@/hooks/useReferrals";
 import { useToast } from "@/hooks/use-toast";
 
 export default function ReferralCard() {
   const { data: referralCode, generateCode } = useMyReferralCode();
   const { data: stats } = useReferralStats();
   const { data: referrals } = useMyReferrals();
   const { toast } = useToast();
   const [copied, setCopied] = useState(false);
 
   const handleCopyCode = () => {
     if (referralCode) {
       navigator.clipboard.writeText(referralCode);
       setCopied(true);
       toast({ title: "Code copié !" });
       setTimeout(() => setCopied(false), 2000);
     }
   };
 
   const handleShare = () => {
     if (referralCode && navigator.share) {
       navigator.share({
         title: "Rejoins Mantalite Kominote RD",
         text: `Utilise mon code ${referralCode} pour obtenir des avantages sur Mantalite Kominote RD !`,
         url: window.location.origin
       });
     }
   };
 
   const formatCurrency = (amount: number) => {
     return new Intl.NumberFormat("es-DO", { style: "decimal", minimumFractionDigits: 0 }).format(amount);
   };
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <Gift className="h-5 w-5 text-purple-500" />
           Programme de parrainage
         </CardTitle>
         <CardDescription>
           Invitez vos amis et gagnez 5% sur leurs 3 premières commandes
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-6">
         {/* Referral Code */}
         <div>
           <label className="text-sm font-medium">Votre code de parrainage</label>
           {referralCode ? (
             <div className="flex gap-2 mt-2">
               <Input value={referralCode} readOnly className="font-mono text-lg" />
               <Button variant="outline" onClick={handleCopyCode}>
                 {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
               </Button>
               <Button variant="outline" onClick={handleShare}>
                 <Share2 className="h-4 w-4" />
               </Button>
             </div>
           ) : (
             <Button 
               className="mt-2 w-full"
               onClick={() => generateCode.mutate()}
               disabled={generateCode.isPending}
             >
               <Gift className="h-4 w-4 mr-2" />
               Générer mon code
             </Button>
           )}
         </div>
 
         {/* Stats */}
         <div className="grid grid-cols-3 gap-4">
           <div className="text-center p-3 bg-muted rounded-lg">
             <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
             <p className="text-2xl font-bold">{stats?.totalReferred || 0}</p>
             <p className="text-xs text-muted-foreground">Filleuls</p>
           </div>
           <div className="text-center p-3 bg-muted rounded-lg">
             <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
             <p className="text-2xl font-bold">{stats?.activeReferrals || 0}</p>
             <p className="text-xs text-muted-foreground">Actifs</p>
           </div>
           <div className="text-center p-3 bg-muted rounded-lg">
             <DollarSign className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
             <p className="text-2xl font-bold">RD$ {formatCurrency(stats?.totalRewards || 0)}</p>
             <p className="text-xs text-muted-foreground">Gagné</p>
           </div>
         </div>
 
         {/* Recent Referrals */}
         {referrals && referrals.length > 0 && (
           <div>
             <h4 className="text-sm font-medium mb-2">Derniers filleuls</h4>
             <div className="space-y-2">
               {referrals.slice(0, 5).map((ref) => (
                 <div key={ref.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                   <span className="text-sm">Filleul #{ref.id.slice(0, 8)}</span>
                   <Badge variant={ref.status === "rewarded" ? "default" : "secondary"}>
                     {ref.status === "rewarded" ? "Récompensé" : ref.status === "active" ? "Actif" : "En attente"}
                   </Badge>
                 </div>
               ))}
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }