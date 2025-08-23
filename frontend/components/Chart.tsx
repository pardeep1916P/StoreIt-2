"use client";

import { useEffect, useState } from "react";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { calculatePercentage, convertFileSize } from "@/lib/utils";

const chartConfig = {
  size: {
    label: "Size",
  },
  used: {
    label: "Used",
    color: "white",
  },
} satisfies ChartConfig;

export const Chart = ({ used = 0 }: { used: number | null | undefined }) => {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        const tablet = width >= 641 && width <= 1024;
        setIsTablet(tablet);

      }
    };

    checkScreenSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkScreenSize);
      return () => window.removeEventListener('resize', checkScreenSize);
    }
  }, []);

  // Calculate total and percentage with safety checks
  const total = 2 * 1024 * 1024 * 1024; // 2GB total
  
  // Ensure used is a valid number
  const safeUsed = isNaN(Number(used)) ? 0 : Math.max(0, Number(used));
  
  // Calculate percentage with safety checks
  let validPercentage = 0;
  if (total > 0 && safeUsed > 0) {
    validPercentage = (safeUsed / total) * 100;
    validPercentage = Math.min(100, Math.max(0, validPercentage));
  }
  
  // Calculate end angle with safety checks
  const endAngle = Math.max(90, Math.min(450, validPercentage * 3.6 + 90)); // 3.6 degrees per 1%
  const safeEndAngle = isNaN(endAngle) ? 90 : endAngle;
  
  // Optimized circle for tablet
  const innerRadius = isTablet ? 90 : 80;
  const outerRadius = isTablet ? 120 : 110;
  
  // Show actual percentage, even if 0
  const displayPercentage = validPercentage;
  const displayEndAngle = safeEndAngle;

    const chartData = [{ name: "used", value: safeUsed, fill: "white" }];

  // Don't render if we have invalid data
  if (isNaN(safeUsed) || safeUsed < 0) {
    return (
      <Card className="chart">
        <CardContent className="flex-1 p-0">
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading chart...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="chart">
      <CardContent className="flex-1 p-0">
        <ChartContainer config={chartConfig} className="chart-container">
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={displayEndAngle}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="polar-grid"
              polarRadius={isTablet ? [96, 84] : [86, 74]}
            />
            <RadialBar dataKey="value" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="chart-total-percentage"
                        >
                          {displayPercentage === 0 ? "0%" : `${displayPercentage.toFixed(1)}%`}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-white/70"
                        >
                          Space used
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardHeader className="chart-details">
        <CardTitle className="chart-title">Available Storage</CardTitle>
        <CardDescription className="chart-description">
          {convertFileSize(safeUsed)} / 2GB
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
