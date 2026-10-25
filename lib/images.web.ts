function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.style.display = "none";

    document.body.appendChild(input);

    function finish(file: File | null) {
      input.remove();
      resolve(file);
    }

    input.onchange = () => {
      finish(input.files?.[0] || null);
    };

    input.addEventListener(
      "cancel",
      () => finish(null),
      { once: true },
    );

    input.click();
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));

    reader.onerror = () => {
      reject(new Error("Unable to read this photo."));
    };

    reader.readAsDataURL(file);
  });
}

function cropImage(
  image: HTMLImageElement,
  ratio: number,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");

    dialog.className = "scanin-crop";
    dialog.setAttribute(
      "aria-labelledby",
      "scanin-crop-title",
    );

    Object.assign(dialog.style, {
      width: "min(560px, calc(100vw - 48px))",
      maxHeight: "90vh",
      padding: "20px",
      border: "1px solid #C9DFD5",
      borderRadius: "20px",
      boxSizing: "border-box",
      background: "#FFFFFF",
      color: "#064E3B",
      fontFamily: "system-ui, sans-serif",
    });

    const style = document.createElement("style");

    style.textContent = `
      dialog.scanin-crop::backdrop {
        background: rgba(0, 0, 0, 0.72);
      }
    `;

    dialog.appendChild(style);

    const title = document.createElement("h2");

    title.id = "scanin-crop-title";
    title.textContent =
      ratio === 1
        ? "Adjust Profile Picture"
        : "Adjust Cover Photo";
    title.style.margin = "0 0 8px";

    const hint = document.createElement("p");

    hint.textContent =
      "Drag the photo to reposition. Use Zoom to adjust. Arrow keys also move the photo.";
    hint.style.fontSize = "14px";

    const canvas = document.createElement("canvas");

    canvas.width = ratio === 1 ? 800 : 1600;
    canvas.height = Math.round(canvas.width / ratio);
    canvas.tabIndex = 0;

    canvas.setAttribute(
      "aria-label",
      "Photo crop area. Drag or use arrow keys to reposition.",
    );

    Object.assign(canvas.style, {
      width: "100%",
      height: "auto",
      display: "block",
      borderRadius: "12px",
      cursor: "grab",
      touchAction: "none",
    });

    const context = canvas.getContext("2d");

    if (!context) {
      reject(
        new Error(
          "Your browser could not open the photo editor.",
        ),
      );
      return;
    }

    const ctx = context;

    const base = Math.max(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight,
    );

    let scale = base;
    let x =
      (canvas.width - image.naturalWidth * scale) / 2;
    let y =
      (canvas.height - image.naturalHeight * scale) / 2;

    let drag: {
      id: number;
      x: number;
      y: number;
    } | null = null;

    function draw() {
      // Keep the image covering the entire crop area.
      x = Math.min(
        0,
        Math.max(
          canvas.width - image.naturalWidth * scale,
          x,
        ),
      );

      y = Math.min(
        0,
        Math.max(
          canvas.height - image.naturalHeight * scale,
          y,
        ),
      );

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(
        image,
        x,
        y,
        image.naturalWidth * scale,
        image.naturalHeight * scale,
      );
    }

    canvas.onpointerdown = (event) => {
      if (drag) return;

      canvas.focus();
      canvas.setPointerCapture(event.pointerId);

      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };

      canvas.style.cursor = "grabbing";
    };

    canvas.onpointermove = (event) => {
      if (!drag || drag.id !== event.pointerId) return;

      const bounds = canvas.getBoundingClientRect();

      x +=
        ((event.clientX - drag.x) * canvas.width) /
        bounds.width;

      y +=
        ((event.clientY - drag.y) * canvas.height) /
        bounds.height;

      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };

      draw();
    };

    function stopDrag() {
      drag = null;
      canvas.style.cursor = "grab";
    }

    canvas.onpointerup = stopDrag;
    canvas.onpointercancel = stopDrag;
    canvas.onlostpointercapture = stopDrag;

    canvas.onkeydown = (event) => {
      const step = event.shiftKey ? 60 : 15;

      if (event.key === "ArrowLeft") x -= step;
      else if (event.key === "ArrowRight") x += step;
      else if (event.key === "ArrowUp") y -= step;
      else if (event.key === "ArrowDown") y += step;
      else return;

      event.preventDefault();
      draw();
    };

    const label = document.createElement("label");

    label.textContent = "Zoom";
    label.htmlFor = "scanin-crop-zoom";

    Object.assign(label.style, {
      display: "block",
      marginTop: "16px",
      fontWeight: "600",
    });

    const zoom = document.createElement("input");

    zoom.id = "scanin-crop-zoom";
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "4";
    zoom.step = "0.01";
    zoom.value = "1";
    zoom.style.width = "100%";
    zoom.style.accentColor = "#047857";

    zoom.oninput = () => {
      const next = base * Number(zoom.value);
      const factor = next / scale;

      x =
        canvas.width / 2 -
        (canvas.width / 2 - x) * factor;

      y =
        canvas.height / 2 -
        (canvas.height / 2 - y) * factor;

      scale = next;
      draw();
    };

    const actions = document.createElement("div");

    Object.assign(actions.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px",
      marginTop: "16px",
    });

    function addButton(
      text: string,
      click: () => void,
      primary = false,
    ) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = text;
      button.onclick = click;

      Object.assign(button.style, {
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid #C9DFD5",
        background: primary ? "#047857" : "#ECFDF5",
        color: primary ? "#FFFFFF" : "#064E3B",
        fontWeight: "700",
        cursor: "pointer",
      });

      actions.appendChild(button);
    }

    let finished = false;

    function finish(value: string | null) {
      if (finished) return;
      finished = true;

      dialog.close();
      dialog.remove();

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      }

      resolve(value);
    }

    addButton("Cancel", () => finish(null));

    addButton("Reset", () => {
      scale = base;
      zoom.value = "1";

      x =
        (canvas.width - image.naturalWidth * scale) / 2;

      y =
        (canvas.height - image.naturalHeight * scale) / 2;

      draw();
    });

    addButton(
      "Use Photo",
      () => {
        try {
          const result = canvas.toDataURL(
            "image/jpeg",
            0.9,
          );

          finish(result);
        } catch {
          finish(null);

          alert(
            "Unable to crop this photo. Please choose another image.",
          );
        }
      },
      true,
    );

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });

    dialog.append(
      title,
      hint,
      canvas,
      label,
      zoom,
      actions,
    );

    document.body.appendChild(dialog);
    dialog.showModal();

    draw();
  });
}

export async function pickImage(
  crop: boolean,
  aspect: [number, number] = [1, 1],
): Promise<string | null> {
  const file = await chooseFile();

  if (!file) return null;
  if (!crop) return readFile(file);

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();

      image.onerror = () => {
        reject(
          new Error(
            "Choose a valid JPG, PNG or WebP photo.",
          ),
        );
      };

      image.src = url;
    });

    const ratio = aspect[0] / aspect[1];

    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error("Invalid crop size.");
    }

    return await cropImage(image, ratio);
  } finally {
    URL.revokeObjectURL(url);
  }
}