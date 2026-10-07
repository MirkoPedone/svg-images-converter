import React, { useState, useEffect } from "react";
import {
  Layout,
  Upload,
  Button,
  Select,
  Space,
  Typography,
  Tooltip,
  message,
  Modal,
  Popconfirm,
  Card,
  List,
  Empty,
  Switch,
  Checkbox,
} from "antd";
import {
  InboxOutlined,
  EditOutlined,
  HeartOutlined,
  HeartFilled,
  CodeOutlined,
  DownloadOutlined,
  BgColorsOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import { ArrowLeft, Cuboid } from "lucide-react";
import ImageTracer from "imagetracerjs";
import { preprocessImage } from "./imageProcessor";
import "./App.css";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const FILTERS = [
  { id: "standard", name: "Standard (Pulito)" },
  { id: "detailed", name: "Dettagliato" },
  { id: "minimal", name: "Semplificato" },
  { id: "edges_thick", name: "Contorni Spessi" },
  { id: "edges_fine", name: "Contorni Fini" },
  { id: "artistic_ink", name: "Inchiostro" },
  { id: "artistic_soft", name: "Sfumato" },
  { id: "sharp", name: "Contrasto Netto" },
];

const NOZZLE_OPTIONS = [
  { value: "0.2", label: "0.2 mm (Dettaglio alto)" },
  { value: "0.4", label: "0.4 mm (Standard)" },
  { value: "0.6", label: "0.6 mm (Veloce)" },
  { value: "0.8", label: "0.8 mm (Molto spesso)" },
];

function getTracerOptions(is3DPrint: boolean) {
  let options = { ...ImageTracer.optionpresets.default };
  options.colorsampling = 0;
  options.numberofcolors = 2;
  options.palette = [
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 },
  ];

  options.ltres = 1;
  options.qtres = 1;
  options.pathomit = 8;
  options.blurradius = 0;

  if (is3DPrint) {
    options.ltres = 1.5;
    options.qtres = 1.5;
  }

  return options;
}

interface SavedSVG {
  id: string;
  svg: string;
  date: string;
  name?: string;
  signature?: string;
  groupId?: string;
  groupName?: string;
}

export default function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Results map filterId -> raw svg string
  const [rawResults, setRawResults] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [inversions, setInversions] = useState<Record<string, boolean>>({});
  const [savedSignatures, setSavedSignatures] = useState<Set<string>>(
    new Set(),
  );
  const [currentGroupId, setCurrentGroupId] = useState<string>("");

  const [is3DPrintMode, setIs3DPrintMode] = useState(false);
  const [nozzleSize, setNozzleSize] = useState("0.4");
  const [fixThinLines, setFixThinLines] = useState(false);

  const [showCode, setShowCode] = useState<string | null>(null); // holds SVG string to show in modal
  const [previewImage, setPreviewImage] = useState<{
    type: "img" | "svg";
    src: string;
  } | null>(null);

  const [savedSvgs, setSavedSvgs] = useState<SavedSVG[]>(() => {
    const saved = localStorage.getItem("saved_svgs");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("saved_svgs", JSON.stringify(savedSvgs));
  }, [savedSvgs]);

  const processAll = async () => {
    if (!imageUrl) return;
    setIsProcessing(true);
    setRawResults({});
    setInversions({});

    for (const filter of FILTERS) {
      try {
        const processedImageUrl = await preprocessImage(
          imageUrl,
          filter.id,
          is3DPrintMode,
          nozzleSize,
          fixThinLines,
        );
        const options = getTracerOptions(is3DPrintMode);

        const svgstr = await new Promise<string>((resolve) => {
          ImageTracer.imageToSVG(
            processedImageUrl,
            (svgstr: string) => resolve(svgstr),
            options,
          );
        });

        setRawResults((prev) => ({ ...prev, [filter.id]: svgstr }));
      } catch (err) {
        console.error(`Errore nel filtro ${filter.name}:`, err);
      }
      // Piccolo delay per permettere a React di renderizzare il risultato prima di bloccare di nuovo il thread
      await new Promise((r) => setTimeout(r, 20));
    }

    setIsProcessing(false);
  };

  useEffect(() => {
    if (imageUrl) {
      processAll();
    }
  }, [imageUrl, is3DPrintMode, nozzleSize, fixThinLines]);

  const getFinalSvg = (filterId: string) => {
    const rawSvg = rawResults[filterId];
    if (!rawSvg) return null;
    const isInv = inversions[filterId];

    let coloredSvg = rawSvg;
    if (isInv) {
      coloredSvg = coloredSvg.replace(
        /fill="rgb\(255,255,255\)"/g,
        `fill="#000000"`,
      );
      coloredSvg = coloredSvg.replace(/fill="rgb\(0,0,0\)"/g, `fill="none"`);
    } else {
      coloredSvg = coloredSvg.replace(/fill="rgb\(0,0,0\)"/g, `fill="#000000"`);
      coloredSvg = coloredSvg.replace(
        /fill="rgb\(255,255,255\)"/g,
        `fill="none"`,
      );
    }

    const match = coloredSvg.match(/width="([0-9.]+)" height="([0-9.]+)"/);
    if (match) {
      coloredSvg = coloredSvg.replace(
        /<svg/,
        `<svg viewBox="0 0 ${match[1]} ${match[2]}" width="100%" height="auto"`,
      );
    }
    return coloredSvg;
  };

  const toggleFavorite = (filterId: string, name: string) => {
    const signature = `${filterId}-${!!inversions[filterId]}`;

    if (savedSignatures.has(signature)) {
      setSavedSvgs((prev) => prev.filter((s) => s.signature !== signature));
      setSavedSignatures((prev) => {
        const next = new Set(prev);
        next.delete(signature);
        return next;
      });
      message.success("Rimosso dai preferiti!");
    } else {
      const svg = getFinalSvg(filterId);
      if (!svg) return;

      const newSvg: SavedSVG = {
        id: Date.now().toString(),
        svg: svg,
        date: new Date().toISOString(),
        name: name,
        signature: signature,
        groupId: currentGroupId,
        groupName: `Sorgente del ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      };
      setSavedSvgs([newSvg, ...savedSvgs]);
      setSavedSignatures((prev) => new Set(prev).add(signature));
      message.success("SVG salvato nei preferiti!");
    }
  };

  const removeFavorite = (id: string) => {
    setSavedSvgs((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item && item.signature) {
        setSavedSignatures((sigs) => {
          const next = new Set(sigs);
          next.delete(item.signature!);
          return next;
        });
      }
      return prev.filter((svg) => svg.id !== id);
    });
    message.success("Rimosso dai preferiti");
  };

  const downloadSvg = (content: string | null, filename = "vectorify.svg") => {
    if (!content) return;
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const props: UploadProps = {
    accept: "image/png, image/jpeg, image/webp",
    fileList,
    beforeUpload: (file) => {
      setFileList([file]);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageUrl(e.target?.result as string);
        setRawResults({});
        setSavedSignatures(new Set());
        setCurrentGroupId(Date.now().toString());
      };
      reader.readAsDataURL(file);
      return false;
    },
    onRemove: () => {
      setFileList([]);
      setImageUrl(null);
      setRawResults({});
      setSavedSignatures(new Set());
    },
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#eaf2ff" }}>
      <Header
        style={{
          background: "rgba(255, 255, 255, 0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Title
          level={4}
          style={{
            margin: 0,
            color: "#2c77fb",
            display: "flex",
            alignItems: "center",
            gap: "2px",
          }}
        >
          Vecto<span style={{ color: "#1a1f2e" }}>Forge</span>
        </Title>
        {imageUrl && (
          <Space size="middle" align="center" wrap>
            <Tooltip title="Ottimizza tracciato per stampanti 3D (Rimuove dettagli troppo sottili)">
              <Switch
                checkedChildren={<Cuboid size={16} />}
                unCheckedChildren={<Cuboid size={16} />}
                checked={is3DPrintMode}
                onChange={setIs3DPrintMode}
              />
            </Tooltip>

            <Select
              disabled={!is3DPrintMode && !fixThinLines}
              value={nozzleSize}
              onChange={setNozzleSize}
              options={NOZZLE_OPTIONS}
              style={{ width: 170 }}
            />

            <Tooltip title="Invece di rimuovere i tratti troppo sottili, li ingrossa forzatamente per renderli stampabili">
              <Checkbox
                checked={fixThinLines}
                onChange={(e) => setFixThinLines(e.target.checked)}
              >
                Ripara linee
              </Checkbox>
            </Tooltip>
          </Space>
        )}
      </Header>

      <Content
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {!imageUrl ? (
          <div style={{ maxWidth: "800px", width: "100%", marginTop: "40px" }}>
            <Title
              level={2}
              style={{
                textAlign: "center",
                marginBottom: "40px",
                color: "#000",
              }}
            >
              Converti le tue immagini in vettori SVG perfetti
            </Title>
            <Dragger {...props}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: "#2c77fb" }} />
              </p>
              <p className="ant-upload-text" style={{ color: "#000" }}>
                Clicca o trascina un'immagine in quest'area
              </p>
              <p className="ant-upload-hint">
                Supporta JPG, PNG, WEBP. L'immagine verrà convertita
                istantaneamente in vari stili SVG.
              </p>
            </Dragger>
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: "1400px" }}>
            {/* Top Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
                alignItems: "center",
              }}
            >
              <Space>
                <Button
                  icon={<ArrowLeft />}
                  onClick={() => {
                    setImageUrl(null);
                    setRawResults({});
                    setFileList([]);
                  }}
                  style={{ borderRadius: "100px" }}
                >
                  Indietro
                </Button>
                <Upload {...props} showUploadList={false}>
                  <Button
                    icon={<EditOutlined />}
                    type="dashed"
                    style={{ borderRadius: "100px" }}
                  >
                    Cambia Immagine
                  </Button>
                </Upload>
              </Space>

              <Space size="middle" className="action-buttons"></Space>
            </div>

            {/* Original Image Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "40px",
              }}
            >
              <div style={{ maxWidth: "400px", width: "100%" }}>
                <Title
                  level={5}
                  style={{
                    textAlign: "center",
                    color: "#595959",
                    marginBottom: "16px",
                  }}
                >
                  Immagine Originale
                </Title>
                <div
                  className="image-container"
                  style={{
                    background: "#ffffff",
                    padding: "24px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setPreviewImage({ type: "img", src: imageUrl })
                  }
                >
                  <img
                    src={imageUrl}
                    alt="Original"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      objectFit: "contain",
                      borderRadius: "12px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Generated Filters Grid */}
            <Title level={4} style={{ marginBottom: "20px", color: "#000" }}>
              Varianti SVG Generate
            </Title>

            <div className="three-col-grid">
              {FILTERS.map((filter) => {
                const finalSvg = getFinalSvg(filter.id);
                const signature = `${filter.id}-${!!inversions[filter.id]}`;
                const isSaved = savedSignatures.has(signature);
                return (
                  <Card
                    key={filter.id}
                    title={filter.name}
                    className="image-container"
                    style={{
                      background: "#fff",
                      borderColor: "#f0f0f0",
                      border: "none",
                      borderRadius: "20px",
                      overflow: "hidden",
                    }}
                    headStyle={{
                      borderBottom: "1px solid #f0f0f0",
                      color: "#000",
                    }}
                    actions={[
                      <Tooltip key="invert" title="Inverti">
                        <Button
                          type="text"
                          disabled={!finalSvg}
                          onClick={() =>
                            setInversions((prev) => ({
                              ...prev,
                              [filter.id]: !prev[filter.id],
                            }))
                          }
                          icon={<BgColorsOutlined />}
                          style={{
                            color: inversions[filter.id]
                              ? "#2c77fb"
                              : undefined,
                          }}
                        />
                      </Tooltip>,
                      <Tooltip key="code" title="Codice Sorgente">
                        <Button
                          type="text"
                          disabled={!finalSvg}
                          onClick={() => setShowCode(finalSvg)}
                          icon={<CodeOutlined />}
                        />
                      </Tooltip>,
                      <Tooltip
                        key="save"
                        title={
                          isSaved
                            ? "Rimuovi dai Preferiti"
                            : "Salva nei Preferiti"
                        }
                      >
                        <Button
                          type="text"
                          disabled={!finalSvg}
                          onClick={() => toggleFavorite(filter.id, filter.name)}
                          icon={
                            isSaved ? (
                              <HeartFilled style={{ color: "#ff4d4f" }} />
                            ) : (
                              <HeartOutlined />
                            )
                          }
                        />
                      </Tooltip>,
                      <Tooltip key="download" title="Scarica">
                        <Button
                          type="text"
                          disabled={!finalSvg}
                          onClick={() =>
                            downloadSvg(finalSvg, `vectoforge-${filter.id}.svg`)
                          }
                          icon={<DownloadOutlined />}
                          style={{ color: "#4caf50" }}
                        />
                      </Tooltip>,
                    ]}
                  >
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "16px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "250px",
                        borderRadius: "12px",
                        border: "1px solid #e8e8e8",
                        overflow: "hidden",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        finalSvg &&
                        setPreviewImage({ type: "svg", src: finalSvg })
                      }
                    >
                      {rawResults[filter.id] ? (
                        <div
                          className="svg-content-wrapper"
                          dangerouslySetInnerHTML={{ __html: finalSvg! }}
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        />
                      ) : isProcessing ? (
                        <Text type="secondary">Generazione...</Text>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Favorites Grid Section */}
        <div style={{ width: "100%", maxWidth: "1400px", marginTop: "60px" }}>
          <Card
            title={
              <>
                <HeartFilled style={{ color: "#ff4d4f", marginRight: "8px" }} />{" "}
                I tuoi SVG Preferiti
              </>
            }
            style={{
              background: "#fff",
              borderColor: "#f0f0f0",
              borderRadius: "20px",
              boxShadow: "0 4px 15px rgba(0,0,0,0.02)",
            }}
            headStyle={{ borderBottom: "1px solid #f0f0f0", color: "#000" }}
          >
            {savedSvgs.length === 0 ? (
              <Empty
                description="Nessun SVG salvato nei preferiti"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div>
                {Object.values(
                  savedSvgs.reduce(
                    (acc, svg) => {
                      const gid = svg.groupId || "old_favorites";
                      if (!acc[gid])
                        acc[gid] = {
                          id: gid,
                          name: svg.groupName || "Raccolta precedente",
                          items: [],
                        };
                      acc[gid].items.push(svg);
                      return acc;
                    },
                    {} as Record<
                      string,
                      { id: string; name: string; items: SavedSVG[] }
                    >,
                  ),
                )
                  .sort((a, b) => Number(b.id) - Number(a.id))
                  .map((group) => (
                    <div key={group.id} style={{ marginBottom: "40px" }}>
                      <Title
                        level={5}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "#1a1f2e",
                          borderBottom: "1px solid #e8e8e8",
                          paddingBottom: "12px",
                          marginBottom: "20px",
                        }}
                      >
                        <FolderOpenOutlined
                          style={{ color: "#2c77fb", fontSize: "20px" }}
                        />
                        Cartella: {group.name}
                      </Title>
                      <List
                        grid={{
                          gutter: 24,
                          xs: 1,
                          sm: 2,
                          md: 3,
                          lg: 3,
                          xl: 3,
                          xxl: 3,
                        }}
                        dataSource={group.items}
                        renderItem={(item) => (
                          <List.Item>
                            <Card
                              style={{
                                background: "#fafafa",
                                borderColor: "#e8e8e8",
                                borderRadius: "12px",
                                overflow: "hidden",
                              }}
                              bodyStyle={{ padding: 0 }}
                              actions={[
                                <Tooltip key="download" title="Scarica">
                                  <Button
                                    type="text"
                                    icon={<DownloadOutlined />}
                                    onClick={() =>
                                      downloadSvg(
                                        item.svg,
                                        `favorite-${item.id}.svg`,
                                      )
                                    }
                                    style={{ color: "#4caf50" }}
                                  />
                                </Tooltip>,
                                <Popconfirm
                                  key="delete"
                                  title="Elimina preferito"
                                  description="Sei sicuro di voler rimuovere questo SVG?"
                                  onConfirm={() => removeFavorite(item.id)}
                                  okText="Ok"
                                  cancelText="Annulla"
                                  placement="top"
                                >
                                  <Tooltip title="Rimuovi">
                                    <Button
                                      type="text"
                                      danger
                                      icon={<DeleteOutlined />}
                                    />
                                  </Tooltip>
                                </Popconfirm>,
                              ]}
                            >
                              <div
                                style={{
                                  background: "#ffffff",
                                  height: "180px",
                                  display: "flex",
                                  justifyContent: "center",
                                  alignItems: "center",
                                  padding: "16px",
                                  borderBottom: "1px solid #e8e8e8",
                                  overflow: "hidden",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  setPreviewImage({
                                    type: "svg",
                                    src: item.svg,
                                  })
                                }
                                dangerouslySetInnerHTML={{ __html: item.svg }}
                              />
                              <div
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                <Text
                                  strong
                                  style={{
                                    display: "block",
                                    marginBottom: "4px",
                                    color: "#000",
                                  }}
                                >
                                  {item.name || "SVG Salvato"}
                                </Text>
                                <Text
                                  type="secondary"
                                  style={{ fontSize: "12px" }}
                                >
                                  Salvato il{" "}
                                  {new Date(item.date).toLocaleDateString()}
                                </Text>
                              </div>
                            </Card>
                          </List.Item>
                        )}
                      />
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      </Content>

      <Modal
        title="Codice Sorgente SVG"
        open={!!showCode}
        onCancel={() => setShowCode(null)}
        footer={null}
        width={800}
      >
        <pre
          style={{
            background: "#f5f5f5",
            padding: "16px",
            borderRadius: "4px",
            maxHeight: "400px",
            overflow: "auto",
            fontSize: "12px",
            color: "#000",
          }}
        >
          {showCode}
        </pre>
      </Modal>

      <Modal
        title="Anteprima Dettagliata"
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        width={1000}
        centered
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            background: "#fff",
            border: "1px solid #f0f0f0",
            borderRadius: "12px",
            height: "70vh",
          }}
        >
          {previewImage?.type === "img" ? (
            <img
              src={previewImage.src}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          ) : previewImage?.type === "svg" ? (
            <div
              dangerouslySetInnerHTML={{ __html: previewImage.src }}
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              className="svg-content-wrapper"
            />
          ) : null}
        </div>
      </Modal>
    </Layout>
  );
}
