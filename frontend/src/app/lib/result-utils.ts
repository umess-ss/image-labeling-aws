import type {
  BoundingBox,
  BoundingBoxLabel,
  FaceResult,
  LabelInstance,
  LabelResult,
  LabelType,
  ResultResponse,
} from "../types";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getLabelName(label: LabelResult) {
  return label.name || label.Name || "Unknown";
}

export function getConfidence(label: LabelResult) {
  const value = label.confidence ?? label.Confidence ?? 0;
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(Math.max(numberValue, 0), 100);
}

export function getInstanceConfidence(
  instance: LabelInstance,
  fallback: number | string | undefined
) {
  const value = instance.Confidence ?? instance.confidence ?? fallback ?? 0;
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.min(Math.max(numberValue, 0), 100);
}

export function normalizeBoundingBox(box?: BoundingBox) {
  const left = box?.Left ?? box?.left;
  const top = box?.Top ?? box?.top;
  const width = box?.Width ?? box?.width;
  const height = box?.Height ?? box?.height;

  if (
    typeof left !== "number" ||
    typeof top !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }

  return {
    Left: left,
    Top: top,
    Width: width,
    Height: height,
  };
}

export function getInstanceBoundingBox(instance: LabelInstance) {
  return normalizeBoundingBox(instance.BoundingBox || instance.boundingBox);
}

export function hasBoundingBox(instance: LabelInstance) {
  return Boolean(getInstanceBoundingBox(instance));
}

export function getBoundingBoxLabels(labels: LabelResult[]): BoundingBoxLabel[] {
  return labels.flatMap((label, labelIndex) => {
    const instances = label.Instances || label.instances || [];
    const name = getLabelName(label);
    const labelConfidence = label.Confidence ?? label.confidence ?? 0;

    return instances.flatMap((instance, instanceIndex) => {
      const box = getInstanceBoundingBox(instance);

      if (!box) {
        return [];
      }

      return {
        id: `${name}-${labelIndex}-${instanceIndex}`,
        name,
        confidence: getInstanceConfidence(instance, labelConfidence),
        box,
        labelIndex,
      };
    });
  });
}

export function getFaceBoundingBoxes(
  faces: FaceResult[] = []
): BoundingBoxLabel[] {
  return faces.flatMap((face, faceIndex) => {
    const box = normalizeBoundingBox(face.BoundingBox || face.boundingBox);

    if (!box) {
      return [];
    }

    return {
      id: `${face.name || "Face"}-${faceIndex}`,
      name: face.name || `Face ${faceIndex + 1}`,
      confidence: getInstanceConfidence(
        {
          Confidence: face.Confidence,
          confidence: face.confidence,
        },
        0
      ),
      box,
      labelIndex: faceIndex + 100,
    };
  });
}

export function getLabelType(label: LabelResult): LabelType {
  const name = getLabelName(label).toLowerCase();
  const categoryNames = (label.Categories || label.categories || [])
    .map((category) =>
      typeof category === "string"
        ? category.toLowerCase()
        : (category.Name || category.name)?.toLowerCase()
    )
    .filter((category): category is string => Boolean(category));

  if (name === "person" || categoryNames?.includes("person")) {
    return "Person";
  }

  if ((label.Instances || label.instances || []).some(hasBoundingBox)) {
    return "Object";
  }

  if (
    categoryNames?.some((category) =>
      ["scene", "landscape", "environment"].includes(category)
    )
  ) {
    return "Scene";
  }

  return "General";
}

export function formatUploadDate(value?: string) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getTopLabels(labels: LabelResult[] = []) {
  return labels
    .map((label) => ({
      name: getLabelName(label),
      confidence: getConfidence(label),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

export function getDisplayImageUrl(item?: ResultResponse | null) {
  return item?.presignedImageUrl || item?.imageUrl || "";
}

function normalizeLabelName(value?: string) {
  return value?.toLowerCase().trim() || "";
}

function hasAnyLabel(labelNames: string[], targets: string[]) {
  const normalizedLabels = labelNames.map(normalizeLabelName);

  return targets.some((target) =>
    normalizedLabels.includes(normalizeLabelName(target))
  );
}

function getLabelInstances(label: LabelResult) {
  return label.Instances || label.instances || [];
}

export function generateSceneSummary(result?: ResultResponse | null) {
  if (!result) {
    return "This image contains general objects and scene labels.";
  }

  const labels = result.labels || [];
  const faces = result.faces || [];
  const labelNames = labels
    .map((label) => getLabelName(label))
    .filter((name) => name && name !== "Unknown");

  const personLabel = labels.find((label) => {
    const name = normalizeLabelName(getLabelName(label));
    return name === "person" || name === "people" || name === "human";
  });

  const personInstanceCount = personLabel
    ? getLabelInstances(personLabel).length
    : 0;
  const faceCount = faces.length;

  let personPhrase = "";

  if (personInstanceCount > 0) {
    personPhrase =
      personInstanceCount === 1
        ? "1 person"
        : `${personInstanceCount} people`;
  } else if (faceCount > 0) {
    personPhrase = faceCount === 1 ? "1 person" : `${faceCount} people`;
  } else if (
    hasAnyLabel(labelNames, ["Person", "People", "Human", "Face", "Head"])
  ) {
    personPhrase = "people";
  }

  const verb =
    personPhrase === "people"
      ? "are"
      : personPhrase.startsWith("1 person")
      ? "is"
      : "are";

  const isPathScene = hasAnyLabel(labelNames, [
    "Path",
    "Walkway",
    "Sidewalk",
    "Road",
    "Street",
  ]);
  const isPavedPathScene = hasAnyLabel(labelNames, [
    "Floor",
    "Flagstone",
    "Pavement",
  ]);
  const isIndoorScene = hasAnyLabel(labelNames, [
    "Room",
    "Indoors",
    "Furniture",
    "Chair",
    "Table",
  ]);
  const isNatureScene = hasAnyLabel(labelNames, [
    "Nature",
    "Plant",
    "Tree",
    "Grass",
    "Mountain",
    "Outdoors",
    "Sky",
  ]);
  const isFoodScene = hasAnyLabel(labelNames, [
    "Food",
    "Dish",
    "Meal",
    "Plate",
  ]);
  const isVehicleScene = hasAnyLabel(labelNames, [
    "Car",
    "Vehicle",
    "Road",
    "Transportation",
    "Automobile",
  ]);
  const isPortraitScene = hasAnyLabel(labelNames, [
    "Portrait",
    "Face",
    "Head",
    "Photography",
  ]);

  const clothingLabels = labelNames.filter((name) =>
    ["Pants", "Dress", "Skirt", "Coat", "Jacket", "Shirt", "Clothing"].some(
      (item) => normalizeLabelName(item) === normalizeLabelName(name)
    )
  );

  if (personPhrase && (isPathScene || isPavedPathScene) && isPortraitScene) {
    return `${personPhrase} ${verb} standing on a walkway or path in an outdoor portrait scene.`;
  }

  if (personPhrase && (isPathScene || isPavedPathScene)) {
    return `${personPhrase} ${verb} shown on a walkway or paved path.`;
  }

  if (personPhrase && isIndoorScene && isPortraitScene) {
    return `${personPhrase} ${verb} shown in an indoor portrait photo.`;
  }

  if (personPhrase && isNatureScene) {
    return `${personPhrase} ${verb} shown in an outdoor nature scene.`;
  }

  if (personPhrase && isPortraitScene) {
    return `${personPhrase} ${verb} shown in a portrait-style photo.`;
  }

  if (isFoodScene) {
    return "This image shows a food scene with plates and dishes.";
  }

  if (isVehicleScene) {
    return "This image shows a vehicle or road-related scene.";
  }

  if (isNatureScene) {
    return "This image appears to show an outdoor nature scene.";
  }

  if (isIndoorScene) {
    return "This image appears to show an indoor room scene.";
  }

  if (isPathScene || isPavedPathScene) {
    return "This image appears to show a walkway, path, or paved surface.";
  }

  if (clothingLabels.length > 0) {
    return `This image includes clothing items such as ${clothingLabels
      .slice(0, 3)
      .join(", ")}.`;
  }

  if (labelNames.length > 0) {
    return `This image contains ${labelNames.slice(0, 4).join(", ")}.`;
  }

  return "This image contains general objects and scene labels.";
}
