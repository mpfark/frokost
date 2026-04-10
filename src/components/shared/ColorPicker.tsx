import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ColorPicker = ({ label, value, onChange, disabled }: ColorPickerProps) => {
  // Convert HSL to hex for color input
  const hslToHex = (hsl: string): string => {
    const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
    const lightness = l / 100;
    const saturation = s / 100;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Convert hex to HSL
  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
  };

  const hexValue = hslToHex(value);

  const handleColorChange = (hex: string) => {
    const hsl = hexToHsl(hex);
    onChange(hsl);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2 items-center">
        <Input
          type="color"
          value={hexValue}
          onChange={(e) => handleColorChange(e.target.value)}
          disabled={disabled}
          className="w-20 h-10 cursor-pointer"
        />
        <div className="flex-1">
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="H S% L%"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        HSL format: hue saturation% lightness%
      </p>
    </div>
  );
};
