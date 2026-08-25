/**
 * Open a FilePicker for a sheet's portrait <img class="profile-img"> and write
 * the chosen path straight to the document via document.update, so it persists
 * even though these sheets run with form.submitOnChange = false (the core
 * `editImage` action relies on form submission, so the picked image silently
 * never saved — the same failure the actor sheet already works around).
 *
 * @param {foundry.abstract.Document} doc     the Item or Actor to update
 * @param {Application} sheet                  the sheet instance (for re-render + positioning)
 * @param {HTMLElement} target                 the clicked <img> (carries data-edit)
 */
export async function browseSheetImage(doc, sheet, target) {
  const attr = target?.dataset?.edit ?? "img";
  const current = foundry.utils.getProperty(doc, attr) ?? doc.img;
  const FP = foundry.applications?.apps?.FilePicker?.implementation
    ?? foundry.applications?.apps?.FilePicker
    ?? FilePicker;
  const picker = new FP({
    type: "image",
    current,
    callback: async (path) => {
      try {
        await doc.update({ [attr]: path });
      } catch (err) {
        console.error("VTMLARP | image update failed", err);
        ui.notifications?.error("Failed to save the image.");
        return;
      }
      sheet.render(false);
    },
    top: (sheet.position?.top ?? 0) + 40,
    left: (sheet.position?.left ?? 0) + 10
  });
  return picker.browse();
}
