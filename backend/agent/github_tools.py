import httpx
import os

# Leemos las variables de entorno (equivalente a process.env.X en Node)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_REPO = os.getenv("GITHUB_REPO", "juanhenaoparra/minidyn")
BASE_URL = "https://api.github.com"

# Headers que van en cada request a GitHub
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",  # f"..." = template literals de JS
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

async def get_branch_diff(branch: str, base: str = "main") -> dict:
    """
    Compara una rama contra main y retorna los archivos cambiados con sus diffs.
    Equivalente a un fetch() async en JS.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/compare/{base}...{branch}"
    
    # httpx.AsyncClient es como axios en JS
    # El "async with" cierra la conexión automáticamente al terminar (como try/finally)
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=HEADERS)
        
        # Manejo de errores
        if resp.status_code == 404:
            return {"error": f"Branch '{branch}' no encontrada."}
        if resp.status_code != 200:
            return {"error": f"GitHub API error: {resp.status_code}"}

        data = resp.json()
        
        files = []
        for f in data.get("files", []):  # .get() es como el ?. de JS (evita KeyError)
            if f.get("status") == "removed":
                continue  # equivalente a "continue" en JS dentro de un for
            files.append({
                "filename": f["filename"],
                "status": f["status"],
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "patch": f.get("patch", "[archivo binario o vacío]"),
            })

        return {
            "branch": branch,
            "base": base,
            "total_commits": data.get("total_commits", 0),
            "files": files,
        }
    
async def get_file_content(filepath: str, branch: str) -> str:
    """
    # Obtiene el contenido completo de un archivo en una rama específica.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/contents/{filepath}?ref={branch}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=HEADERS)
        
        if resp.status_code == 404:
            return f"[Archivo no encontrado: {filepath}]"
        if resp.status_code != 200:
            return f"[GitHub API error: {resp.status_code}]"

        data = resp.json()
        
        # GitHub retorna el contenido en base64, hay que decodificarlo
        if data.get("encoding") == "base64":
            import base64
            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return content
        
        return "[No se pudo decodificar el archivo]"


async def get_repo_tree(branch: str) -> list[str]:
    """
    Retorna la lista de todos los archivos del repo en una rama.
    """
    url = f"{BASE_URL}/repos/{GITHUB_REPO}/git/trees/{branch}?recursive=1"
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=HEADERS)
        
        if resp.status_code != 200:
            return []

        data = resp.json()
        
        # Filtramos solo archivos (no carpetas)
        return [
            item["path"]
            for item in data.get("tree", [])
            if item["type"] == "blob"  # "blob" = archivo, "tree" = carpeta
        ]
    
    [item["path"] for item in data["tree"] if item["type"] == "blob"]