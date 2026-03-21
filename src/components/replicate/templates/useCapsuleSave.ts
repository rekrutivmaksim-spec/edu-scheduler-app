import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";

const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";

interface User {
  id: string;
  email: string;
  unlimited_access?: boolean;
}

export function useCapsuleSave(user: User | null, cdnImageUrl: string | null) {
  const { lookbooks, refetchLookbooks } = useData();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedLookbookId, setSelectedLookbookId] = useState("");
  const [newLookbookName, setNewLookbookName] = useState("");
  const [newLookbookPersonName, setNewLookbookPersonName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveToExistingLookbook = async () => {
    if (!selectedLookbookId || !user) return;
    if (!cdnImageUrl) {
      toast.error("Изображение ещё сохраняется, подождите...");
      return;
    }
    setIsSaving(true);
    try {
      const lookbook = lookbooks?.find(
        (lb: { id: string; photos?: string[] }) => lb.id === selectedLookbookId,
      );
      const updatedPhotos = [...(lookbook?.photos || []), cdnImageUrl];
      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: "lookbooks",
          action: "update",
          where: { id: selectedLookbookId },
          data: { photos: updatedPhotos },
        }),
      });
      if (response.ok) {
        toast.success("Фото добавлено в лукбук!");
        setShowSaveDialog(false);
        setSelectedLookbookId("");
        await refetchLookbooks();
      } else {
        throw new Error("Failed to save");
      }
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToNewLookbook = async () => {
    if (!newLookbookName || !newLookbookPersonName || !user) return;
    if (!cdnImageUrl) {
      toast.error("Изображение ещё сохраняется, подождите...");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: "lookbooks",
          action: "insert",
          data: {
            user_id: user.id,
            name: newLookbookName,
            person_name: newLookbookPersonName,
            photos: [cdnImageUrl],
            color_palette: [],
          },
        }),
      });
      if (response.ok) {
        toast.success("Лукбук создан!");
        setShowSaveDialog(false);
        setNewLookbookName("");
        setNewLookbookPersonName("");
        await refetchLookbooks();
      } else {
        throw new Error("Failed to create lookbook");
      }
    } catch {
      toast.error("Ошибка создания лукбука");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    lookbooks,
    showSaveDialog,
    setShowSaveDialog,
    selectedLookbookId,
    setSelectedLookbookId,
    newLookbookName,
    setNewLookbookName,
    newLookbookPersonName,
    setNewLookbookPersonName,
    isSaving,
    handleSaveToExistingLookbook,
    handleSaveToNewLookbook,
  };
}
