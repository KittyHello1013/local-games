(() => {
  "use strict";

  let dialog;
  let titleEl;
  let messageEl;
  let primaryButton;
  let secondaryButton;
  let primaryAction = null;
  let secondaryAction = null;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "completion-dialog";
    dialog.setAttribute("aria-labelledby", "completion-title");

    const panel = document.createElement("div");
    panel.className = "completion-dialog__panel";

    titleEl = document.createElement("h2");
    titleEl.id = "completion-title";
    messageEl = document.createElement("p");
    messageEl.className = "completion-dialog__message";

    const actions = document.createElement("div");
    actions.className = "completion-dialog__actions";
    primaryButton = document.createElement("button");
    primaryButton.type = "button";
    primaryButton.className = "button button--primary";
    primaryButton.dataset.completionAction = "primary";
    secondaryButton = document.createElement("button");
    secondaryButton.type = "button";
    secondaryButton.className = "button button--secondary";
    secondaryButton.dataset.completionAction = "secondary";
    actions.append(primaryButton, secondaryButton);
    panel.append(titleEl, messageEl, actions);
    dialog.append(panel);
    document.body.append(dialog);

    primaryButton.addEventListener("click", () => {
      const action = primaryAction;
      dialog.close();
      action?.();
    });
    secondaryButton.addEventListener("click", () => {
      const action = secondaryAction;
      dialog.close();
      action?.();
    });
    dialog.addEventListener("close", () => {
      primaryAction = null;
      secondaryAction = null;
    });
  }

  function show(options) {
    ensureDialog();
    titleEl.textContent = options.title;
    messageEl.textContent = options.message;
    primaryButton.textContent = options.primaryText || "下一关";
    secondaryButton.textContent = options.secondaryText || "留在这里";
    primaryAction = options.onPrimary || null;
    secondaryAction = options.onSecondary || null;
    if (dialog.open) dialog.close();
    dialog.showModal();
    primaryButton.focus();
  }

  window.GameCompletion = { show };
})();
