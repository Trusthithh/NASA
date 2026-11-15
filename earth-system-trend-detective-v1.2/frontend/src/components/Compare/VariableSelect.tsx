import React from "react";
import { DatasetInfo } from "../../types/science";
import { input, label } from "../../styles/ui";

interface VariableSelectProps {
  id: string;
  title: string;
  value: string;
  datasets: DatasetInfo[];
  onChange: (id: string) => void;
}

export const VariableSelect: React.FC<VariableSelectProps> = ({ id, title, value, datasets, onChange }) => {
  const categories = Array.from(new Set(datasets.map((d) => d.category)));
  return (
    <div>
      <label className={label} htmlFor={id}>{title}</label>
      <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
        {categories.map((cat) => (
          <optgroup key={cat} label={cat}>
            {datasets
              .filter((d) => d.category === cat)
              .map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};
