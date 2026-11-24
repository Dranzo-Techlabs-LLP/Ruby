// A small ZIP writer on top of node:zlib, shared by package.mjs and package-cpanel.mjs.
//
//   writeZip(entries, outFile)
//   entries: [{ name: 'admin/', dir: true } | { name: 'api/index.php', data: Buffer, mode?: 0o644 }]
//
// Entry names use "/" and carry Unix modes (files 0644 unless given, folders 0755),
// which is what cPanel's Extract and `unzip` on the server apply.
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

// CRC-32: zlib.crc32 exists from Node 20.15 / 22.2; table fallback for older versions.
let crcTable
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Writes the entries to outFile and returns the zip's size in bytes. */
export function writeZip(entries, outFile) {
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const parts = []
  const central = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const data = e.dir ? Buffer.alloc(0) : e.data
    const packed = e.dir ? data : zlib.deflateRawSync(data, { level: 9 })
    const stored = e.dir || packed.length >= data.length // JPEGs and zips don't shrink; store them
    const body = stored ? data : packed
    const method = stored ? 0 : 8
    const crc = e.dir ? 0 : crc32(data)
    const mode = e.dir ? 0o40755 : 0o100000 | (e.mode ?? 0o644)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0) // local file header
    header.writeUInt16LE(20, 4) //         version needed (2.0)
    header.writeUInt16LE(0x0800, 6) //     UTF-8 names
    header.writeUInt16LE(method, 8)
    header.writeUInt16LE(dosTime, 10)
    header.writeUInt16LE(dosDate, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(body.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(name.length, 26)
    header.writeUInt16LE(0, 28) //         no extra field
    parts.push(header, name, body)

    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50, 0) // central directory header
    record.writeUInt16LE((3 << 8) | 20, 4) // made by Unix, so the modes below apply
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x0800, 8)
    record.writeUInt16LE(method, 10)
    record.writeUInt16LE(dosTime, 12)
    record.writeUInt16LE(dosDate, 14)
    record.writeUInt32LE(crc, 16)
    record.writeUInt32LE(body.length, 20)
    record.writeUInt32LE(data.length, 24)
    record.writeUInt16LE(name.length, 28)
    // bytes 30–37: extra length, comment length, disk number, internal attributes (all 0)
    record.writeUInt32LE(((mode << 16) | (e.dir ? 0x10 : 0)) >>> 0, 38)
    record.writeUInt32LE(offset, 42)
    central.push(record, name)

    offset += header.length + name.length + body.length
  }

  const centralSize = central.reduce((n, b) => n + b.length, 0)
  if (entries.length > 0xffff || offset + centralSize > 0xffffffff) throw new Error('Too big for a plain ZIP (needs ZIP64).')

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)

  const zip = Buffer.concat([...parts, ...central, end])
  writeFileSync(outFile, zip)
  return zip.length
}

/** YYYYMMDD-HHMM, for release file names. */
export function stamp(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}
