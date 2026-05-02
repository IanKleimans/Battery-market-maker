/** CSV + PDF export for the GPU calculator results. */

import type {
  CalculatorInputs,
  CalculatorOutputs,
  Region,
  GPUModel,
} from './gpuCalculator'
import { GPU_MODELS, REGIONS } from './gpuCalculator'

function findRegion(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id)
}

function findModel(id: string): GPUModel | undefined {
  return GPU_MODELS.find((m) => m.id === id)
}

export function buildCSV(inputs: CalculatorInputs, outputs: CalculatorOutputs): string {
  const lines: string[] = []
  lines.push('section,key,value,unit')

  // Inputs
  lines.push(`inputs,num_gpus,${inputs.num_gpus},`)
  lines.push(`inputs,gpu_model,${findModel(inputs.gpu_model)?.name ?? inputs.gpu_model},`)
  lines.push(`inputs,utilization,${(inputs.utilization * 100).toFixed(1)},%`)
  lines.push(`inputs,pue,${inputs.pue.toFixed(2)},`)
  lines.push(`inputs,region,${findRegion(inputs.region)?.name ?? inputs.region},`)
  lines.push(`inputs,solar_ppa,${inputs.solar_ppa},`)
  if (inputs.storage.enabled) {
    lines.push(`inputs,storage_mwh,${inputs.storage.capacity_mwh},MWh`)
    lines.push(`inputs,storage_revenue_per_kw_yr,${inputs.storage.revenue_per_kw_yr},USD/kW-yr`)
  }
  if (inputs.demand_response.enabled) {
    lines.push(`inputs,dr_revenue_per_kw_yr,${inputs.demand_response.revenue_per_kw_yr},USD/kW-yr`)
  }

  // Outputs
  lines.push(`outputs,total_power_kw,${outputs.total_power_kw.toFixed(0)},kW`)
  lines.push(`outputs,annual_energy_twh,${outputs.annual_energy_twh.toFixed(3)},TWh`)
  lines.push(`outputs,annual_cost_usd,${outputs.annual_cost_usd.toFixed(0)},USD`)
  lines.push(`outputs,monthly_cost_usd,${outputs.monthly_cost_usd.toFixed(0)},USD`)
  lines.push(`outputs,cost_per_gpu_yr,${outputs.cost_per_gpu_yr.toFixed(0)},USD/GPU-yr`)
  lines.push(`outputs,co2_tons_yr,${outputs.co2_tons_yr.toFixed(0)},tCO2/yr`)
  lines.push(`outputs,homes_equivalent,${outputs.homes_equivalent.toFixed(0)},US homes`)
  lines.push(`outputs,storage_revenue_usd,${outputs.storage_revenue_usd.toFixed(0)},USD`)
  lines.push(`outputs,dr_revenue_usd,${outputs.dr_revenue_usd.toFixed(0)},USD`)
  lines.push(`outputs,net_cost_usd,${outputs.net_cost_usd.toFixed(0)},USD`)
  lines.push(`outputs,effective_rate_per_kwh,${outputs.effective_rate_per_kwh.toFixed(3)},USD/kWh`)

  // Region comparison
  lines.push('')
  lines.push('region_id,region_name,rate_usd_per_kwh,carbon_g_per_kwh,annual_cost_usd,delta_vs_selected_usd')
  for (const row of outputs.ranking) {
    lines.push(
      `${row.region.id},${row.region.name},${row.region.rate_per_kwh.toFixed(3)},${row.region.carbon_g_per_kwh},${row.annual_cost_usd.toFixed(0)},${row.delta_usd.toFixed(0)}`,
    )
  }

  return lines.join('\n')
}

function downloadBlob(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadCSV(inputs: CalculatorInputs, outputs: CalculatorOutputs): void {
  const ts = new Date().toISOString().slice(0, 10)
  downloadBlob(buildCSV(inputs, outputs), 'text/csv', `gpu-calculator-${ts}.csv`)
}

export async function downloadPDF(
  inputs: CalculatorInputs,
  outputs: CalculatorOutputs,
): Promise<void> {
  // Lazy-load jsPDF so the calculator route doesn't pay for it on first paint.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const ts = new Date().toISOString().slice(0, 10)
  const region = findRegion(inputs.region)
  const model = findModel(inputs.gpu_model)

  let y = 56
  doc.setFont('helvetica', 'bold').setFontSize(18).text('GPU Cluster Cost Report', 56, y)
  y += 8
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120)
  doc.text(`Generated ${ts} · Battery Market Maker`, 56, (y += 14))
  doc.setTextColor(0)

  // Inputs section
  y += 26
  doc.setFont('helvetica', 'bold').setFontSize(12).text('Inputs', 56, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  const inLines: Array<[string, string]> = [
    ['GPUs', inputs.num_gpus.toLocaleString()],
    ['Model', model?.name ?? inputs.gpu_model],
    ['Utilization', `${(inputs.utilization * 100).toFixed(0)}%`],
    ['PUE', inputs.pue.toFixed(2)],
    ['Region', region?.name ?? inputs.region],
    ['Solar PPA', inputs.solar_ppa ? 'on' : 'off'],
  ]
  if (inputs.storage.enabled) {
    inLines.push(['Storage', `${inputs.storage.capacity_mwh} MWh @ $${inputs.storage.revenue_per_kw_yr}/kW-yr`])
  }
  if (inputs.demand_response.enabled) {
    inLines.push(['Demand response', `$${inputs.demand_response.revenue_per_kw_yr}/kW-yr`])
  }
  for (const [k, v] of inLines) {
    y += 14
    doc.text(`${k}:`, 64, y)
    doc.text(v, 200, y)
  }

  // Headline
  y += 28
  doc.setFont('helvetica', 'bold').setFontSize(14).text('Estimated annual electricity cost', 56, y)
  y += 22
  doc.setFontSize(28).setTextColor(37, 99, 235)
  doc.text(`$${outputs.annual_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 56, y)
  doc.setTextColor(0)

  // Metrics grid
  y += 24
  doc.setFont('helvetica', 'bold').setFontSize(12).text('Metrics', 56, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  const m: Array<[string, string]> = [
    ['Total power', `${outputs.total_power_kw.toLocaleString(undefined, { maximumFractionDigits: 0 })} kW`],
    ['Annual energy', `${outputs.annual_energy_twh.toFixed(3)} TWh`],
    ['Monthly cost', `$${outputs.monthly_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
    ['Cost per GPU', `$${outputs.cost_per_gpu_yr.toLocaleString(undefined, { maximumFractionDigits: 0 })} /yr`],
    ['CO2 footprint', `${outputs.co2_tons_yr.toLocaleString(undefined, { maximumFractionDigits: 0 })} t/yr`],
    ['US homes powered', outputs.homes_equivalent.toLocaleString(undefined, { maximumFractionDigits: 0 })],
  ]
  for (const [k, v] of m) {
    y += 14
    doc.text(`${k}:`, 64, y)
    doc.text(v, 200, y)
  }

  if (outputs.storage_revenue_usd > 0 || outputs.dr_revenue_usd > 0) {
    y += 18
    doc.setFont('helvetica', 'bold').setFontSize(12).text('Net cost after revenue', 56, y)
    doc.setFont('helvetica', 'normal').setFontSize(10)
    if (outputs.storage_revenue_usd > 0) {
      y += 14
      doc.text('Storage revenue:', 64, y)
      doc.text(`-$${outputs.storage_revenue_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 200, y)
    }
    if (outputs.dr_revenue_usd > 0) {
      y += 14
      doc.text('DR revenue:', 64, y)
      doc.text(`-$${outputs.dr_revenue_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 200, y)
    }
    y += 14
    doc.setFont('helvetica', 'bold')
    doc.text('Net cost:', 64, y)
    doc.text(`$${outputs.net_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 200, y)
    doc.setFont('helvetica', 'normal')
  }

  // Page 2: region comparison
  doc.addPage()
  y = 56
  doc.setFont('helvetica', 'bold').setFontSize(14).text('Region comparison', 56, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120)
  y += 14
  doc.text('Same cluster spec, all 11 regions ranked by annual electricity cost.', 56, y)
  doc.setTextColor(0)

  y += 20
  doc.setFont('helvetica', 'bold').setFontSize(9)
  doc.text('Region', 56, y)
  doc.text('Rate ($/kWh)', 200, y)
  doc.text('CO2 (g/kWh)', 290, y)
  doc.text('Annual cost', 380, y)
  doc.text('Delta vs selected', 480, y)
  doc.setFont('helvetica', 'normal')

  for (const row of outputs.ranking) {
    y += 14
    if (y > 740) {
      doc.addPage()
      y = 56
    }
    const isCurrent = row.region.id === inputs.region
    if (isCurrent) doc.setFont('helvetica', 'bold')
    doc.text(row.region.name, 56, y)
    doc.text(row.region.rate_per_kwh.toFixed(3), 200, y)
    doc.text(row.region.carbon_g_per_kwh.toFixed(0), 290, y)
    doc.text(`$${row.annual_cost_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 380, y)
    if (isCurrent) {
      doc.text('—', 480, y)
    } else {
      const sign = row.delta_usd >= 0 ? '+' : '-'
      doc.text(
        `${sign}$${Math.abs(row.delta_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        480,
        y,
      )
    }
    if (isCurrent) doc.setFont('helvetica', 'normal')
  }

  doc.save(`gpu-calculator-${ts}.pdf`)
}
