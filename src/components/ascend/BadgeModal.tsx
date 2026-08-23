import { motion } from "motion/react";
import { Award } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Badge } from "@/lib/ascend/badges";

export function BadgeModal({
  badge,
  onClose,
}: {
  badge: Badge | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={badge !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xs text-center">
        {badge && (
          <>
            <motion.div
              initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="mx-auto grid size-20 place-items-center rounded-full"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
            >
              <Award className="size-9 text-primary-foreground" />
            </motion.div>
            <DialogTitle className="font-display text-xl">{badge.label}</DialogTitle>
            <DialogDescription>{badge.description}</DialogDescription>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{badge.tier} badge</p>
            <Button onClick={onClose} className="mt-2 w-full">
              Keep climbing
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
